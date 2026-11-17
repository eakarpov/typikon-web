import Database from 'better-sqlite3';
import { readFileSync, statSync } from 'node:fs';
import { ObjectId, type Db } from 'mongodb';
import { fail, sha, revision, nativeKey, type Obj } from './core';

let opened: { stamp: string, db: Database.Database, datasetRevision: string } | undefined;
export function rules() {
    const path = process.env.RULES_DB; if (!path) fail('corpus_unavailable', 503, 'Не задан певческий корпус.');
    try { const st = statSync(path!); const stamp = path + ':' + st.ino + ':' + st.size + ':' + st.mtimeMs; if (opened?.stamp !== stamp) { opened?.db.close(); const db = new Database(path!, { readonly: true, fileMustExist: true }); opened = { stamp, db, datasetRevision: revision('ds1', { profile: 'dataset-r1', artifacts: [{ name: 'rules.db', sha256: sha(readFileSync(path!)) }] }) }; } return opened!; } catch (error) { if (error instanceof Error && 'code' in error && String((error as any).code).startsWith('reader')) throw error; fail('corpus_unavailable', 503, 'Певческий корпус недоступен.'); }
}
const SQL = `SELECT ci.*,g.slot_key AS group_slot,c.slot_key AS canon_slot,COALESCE(g.source_book,a.source_book,e.source_book) AS source_book,
 COALESCE(g.memory_id,c.memory_id) AS memory_id FROM content_items ci
 LEFT JOIN groups g ON g.group_id=ci.group_id LEFT JOIN canons c ON c.canon_id=ci.canon_id
 LEFT JOIN editions e ON e.edition_id=c.edition_id LEFT JOIN akathists a ON a.akathist_id=ci.akathist_id`;
export function resolvedRow(row: Obj, db = rules().db, seen = new Set<number>()): Obj {
    if (row.text !== null && row.text !== undefined) return { raw: row.text, ref: { namespace: 'rules.content_items', id: String(row.item_id) } };
    if (seen.has(row.item_id) || seen.size > 16) fail('corpus_unavailable', 503, 'Циклическая ссылка песнопения.'); seen.add(row.item_id);
    if (row.ref_text_id) { const f: any = db.prepare('SELECT * FROM fixed_texts WHERE text_id=?').get(row.ref_text_id); if (f?.text != null) return { raw: f.text, ref: { namespace: 'rules.fixed_texts', id: String(f.text_id) } }; }
    if (row.ref_item_id) { const other: any = db.prepare('SELECT * FROM content_items WHERE item_id=?').get(row.ref_item_id); if (other) return resolvedRow(other, db, seen); }
    fail('corpus_unavailable', 503, 'Ссылка на тело песнопения не разрешена.');
}
export function contextOf(row: Obj) { return { root: row.canon_slot ?? row.group_slot ?? row.akathist_id ?? row.prayer_id ?? null, language: row.language, sourceBook: row.source_book ?? null, ode: row.ode ?? null, index: row.item_index, unit: row.content_unit, stanzaKind: row.stanza_kind ?? null, stanza: row.stanza ?? null, marker: row.marker ?? null }; }
export function signatureOf(row: Obj, body: Obj) { return revision('sig1', { context: contextOf(row), bodyKind: body.ref.namespace, bodyRevision: 'br1_' + sha(body.raw) }); }
export function scanRows() { const { db } = rules(); return db.prepare(SQL + ' ORDER BY ci.item_id').iterate() as Iterable<Obj>; }
export function nativeRow(id: number) { return rules().db.prepare(SQL + ' WHERE ci.item_id=?').get(id) as Obj | undefined; }
export async function loadNative(db: Db, ref: Obj): Promise<Obj> {
    if (ref.kind === 'text') {
        if (!ObjectId.isValid(ref.id)) fail('not_found', 404, 'Неизвестный текст.');
        const text = await db.collection('texts').findOne({ _id: new ObjectId(ref.id) }); const book = text?.bookId ? await db.collection('books').findOne({ _id: text.bookId }) : null;
        if (!text || text.public === false || book?.public === false || !['ready', 'correcting', 'texted'].includes(text.readiness) || !text.content?.trim()) fail('not_found', 404, 'Текст недоступен.');
        return { title: text!.name, language: text!.language ?? book?.language ?? 'cu', editorialStatus: text!.readiness, legacyTarget: { kind: 'text', id: ref.id, edition: String(text!.bookId ?? ref.id) }, items: [{ root: true, raw: text!.content, ref: { namespace: 'typikon.texts', id: ref.id }, placement: { ode: null, unit: 'body', stanzaKind: null, stanza: null, marker: null }, repeatCount: 1 }], footnotes: text!.footnotes ?? [], text, book };
    }
    const { db: sql } = rules(); let rows: Obj[], head: Obj | undefined;
    if (ref.kind === 'canon') { head = sql.prepare('SELECT * FROM canons WHERE canon_id=?').get(ref.id) as Obj; rows = sql.prepare(SQL + ' WHERE ci.canon_id=? ORDER BY ci.ode,ci.item_index,ci.item_id').all(ref.id) as Obj[]; }
    else if (ref.kind === 'akathist') { head = sql.prepare('SELECT * FROM akathists WHERE akathist_id=?').get(ref.id) as Obj; rows = sql.prepare(SQL + ' WHERE ci.akathist_id=? ORDER BY ci.item_index,ci.item_id').all(ref.id) as Obj[]; }
    else if (ref.kind === 'chant') { const row = nativeRow(Number(ref.id)); head = row; rows = row ? [row] : []; }
    else fail('unsupported_source', 422, 'В пилоте этот источник не поддержан.');
    if (!head! || !rows!.length) fail('not_found', 404, 'Источник не найден.');
    return { title: head!.title, language: head!.language ?? rows![0].language, editorialStatus: 'not_reviewed_for_pilot', head, items: rows!.map(row => ({ ...resolvedRow(row), row, placement: { ode: row.ode ?? null, unit: row.content_unit, stanzaKind: row.stanza_kind ?? null, stanza: row.stanza ?? null, marker: row.marker ?? null }, repeatCount: row.repeat_count || 1, rubric: row.inline_rubric ?? null })), footnotes: [] };
}
export async function loadBody(db: Db, binding: Obj): Promise<string> {
    let raw: string | undefined;
    if (binding.nativeRef.namespace === 'typikon.texts') {
        const text = await db.collection('texts').findOne({ _id: new ObjectId(binding.nativeRef.id) }); const book = text?.bookId ? await db.collection('books').findOne({ _id: text.bookId }) : null;
        if (!text || text.public === false || book?.public === false || !['ready', 'correcting', 'texted'].includes(text.readiness)) fail('not_found', 404, 'Источник закрыт.');
        raw = binding.footnoteIndex === undefined ? text.content : text.footnotes?.[binding.footnoteIndex];
    } else {
        const current = rules(); if (current.datasetRevision !== binding.datasetRevision) fail('revision_unavailable', 410, 'Для этой ревизии нужна прежняя сборка корпуса.');
        const table = binding.nativeRef.namespace === 'rules.fixed_texts' ? 'fixed_texts' : 'content_items'; const key = table === 'fixed_texts' ? 'text_id' : 'item_id';
        const row: any = current.db.prepare(`SELECT text FROM ${table} WHERE ${key}=?`).get(binding.nativeRef.id); raw = row?.text;
    }
    if (typeof raw !== 'string' || 'br1_' + sha(raw) !== binding.bodyRevision) fail('revision_unavailable', 410, 'Прежнее тело изменено или недоступно.'); return raw!;
}
