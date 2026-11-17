import Database from 'better-sqlite3';
import { chmodSync, existsSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DictionaryPublication } from '@/lib/csDictionary/database';
import { canonical, fail, PILOT, revision, sha, type Obj } from '../core';
import { profileSets, project } from '../projection';
import type { ReaderService } from '../service';

export const INDEX_CONTRACT = 'cs-index/1';
export const INDEX_LIMITS = { pageDefault: 20, pageMax: 50, queryMaxUtf16: 200, phraseMaxTokens: 12, traversalMax: 500, snippetMaxRawUtf16: 512, maxResponseBytes: 1048576 };
// Any code change affecting tokenization, keys, matching or deduplication must change this version.
export const INDEX_RULES = { format: 'cs-index-sqlite/1', projection: 'reader-projection-r1', query: 'whole-token-sequence-r1', deduplication: 'occurrence-body-ordered-token-r1', candidate: 'exact-dictionary-search-top5-unreviewed-r1' };
export const profileFingerprints = () => profileSets.filter(p => INDEX_PROFILE_IDS.includes(p.id)).map(p => ({ id: p.id, fingerprint: revision('pf1', { profile: p, rules: INDEX_RULES }) }));
export const INDEX_PROFILE_IDS = ['cs-pilot-source-r1', 'cs-pilot-unicode-r1'];
export const lexical = (t: Obj) => ['word', 'numberCandidate', 'unresolved'].includes(t.type);
export const bodyKey = (b: Obj) => b.bodyId + ':' + b.bodyRevision;
export function hitId(occurrenceId: string, body: Obj, tokenIds: string[]) { return revision('hit1', { occurrenceId, bodyId: body.bodyId, bodyRevision: body.bodyRevision, tokenIds }); }
export type Review = { id: string; decision: 'accepted' | 'rejected'; occurrenceId: string; bodyId: string; bodyRevision: string; tokenIds: string[]; lexemeId: string; dictionaryVersion: string; sourceId: string; sourceRevision: string; rawRanges: number[][]; quoteSha256: string; dictionarySourceIds: string[]; reviewer: string; rationale: string };
export type BuildOptions = { outputDir: string; dictionary: DictionaryPublication; reviews?: Review[]; reuse?: string };
const tables = ['bodies', 'placements', 'tokens', 'search_keys', 'candidates', 'reviews', 'accepted_links'] as const;
function tableHash(db: Database.Database, table: string) { return sha(canonical(db.prepare(`SELECT * FROM ${table} ORDER BY 1,2,3`).all())); }
export function openIndex(path: string) {
    const db = new Database(path, { readonly: true, fileMustExist: true });
    try {
        const row = db.prepare('SELECT payload FROM manifest WHERE id=1').get() as Obj;
        const manifest = JSON.parse(row.payload);
        const { indexRevision, ...content } = manifest;
        if (manifest.format !== INDEX_RULES.format || indexRevision !== revision('ix1', content)) throw Error('Invalid manifest');
        return { db, manifest };
    } catch (e) { db.close(); throw e; }
}
export function verifyIndex(index: ReturnType<typeof openIndex>) {
    for (const table of tables) if (tableHash(index.db, table) !== index.manifest.tableHashes[table]) throw Error('Index table hash mismatch: ' + table);
    if ((index.db.pragma('integrity_check', { simple: true })) !== 'ok') throw Error('Index integrity failure');
}
/** Build from existing reader identities. Never allocates an identity or stores raw/view text. */
export async function buildIndex(reader: ReaderService, options: BuildOptions) {
    const { release } = await reader.release();
    const temporary = join(options.outputDir, '.index-' + randomUUID() + '.sqlite');
    const db = new Database(temporary);
    let old: ReturnType<typeof openIndex> | undefined;
    let completed = false;
    const stats = { navigationMaterials: release.entries.length, navigationUnits: 0, placements: 0, bodies: 0, tokens: 0, searchableTokens: 0, blockedTokens: 0, candidateLinks: 0, acceptedLinks: 0, reusedBodies: 0 };
    try {
        old = options.reuse ? openIndex(options.reuse) : undefined;
        db.exec(`PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON;
          CREATE TABLE manifest(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL);
          CREATE TABLE bodies(body_key TEXT PRIMARY KEY,body_id TEXT NOT NULL,body_revision TEXT NOT NULL,length_utf16 INTEGER NOT NULL,chant INTEGER NOT NULL);
          CREATE TABLE placements(occurrence_id TEXT PRIMARY KEY,body_key TEXT NOT NULL REFERENCES bodies,ordinal INTEGER NOT NULL,payload TEXT NOT NULL);
          CREATE TABLE tokens(body_key TEXT NOT NULL REFERENCES bodies,position INTEGER NOT NULL,token_id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(body_key,position),UNIQUE(body_key,token_id));
          CREATE TABLE search_keys(key TEXT NOT NULL,body_key TEXT NOT NULL,position INTEGER NOT NULL,match_kind TEXT NOT NULL,PRIMARY KEY(key,body_key,position));
          CREATE INDEX token_search ON search_keys(body_key,position,key);
          CREATE TABLE candidates(body_key TEXT NOT NULL,position INTEGER NOT NULL,lexeme_id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(body_key,position,lexeme_id));
          CREATE INDEX candidate_lexeme ON candidates(lexeme_id,body_key,position);
          CREATE TABLE reviews(id TEXT PRIMARY KEY,occurrence_id TEXT NOT NULL,lexeme_id TEXT NOT NULL,payload TEXT NOT NULL);
          CREATE TABLE accepted_links(occurrence_id TEXT NOT NULL REFERENCES placements,position INTEGER NOT NULL,end_position INTEGER NOT NULL,lexeme_id TEXT NOT NULL,review_id TEXT NOT NULL REFERENCES reviews,PRIMARY KEY(occurrence_id,position,end_position));
          CREATE INDEX accepted_lexeme ON accepted_links(lexeme_id,occurrence_id,position);`);
        const bodies = new Map<string, Obj>(), placements = new Map<string, Obj>();
        if (old) verifyIndex(old);
        const reuseCompatible = old && old.manifest.profileFingerprints.find((p: Obj) => p.id === 'cs-pilot-source-r1')?.fingerprint === profileFingerprints().find(p => p.id === 'cs-pilot-source-r1')?.fingerprint;
        const insertBody = db.prepare('INSERT INTO bodies VALUES(?,?,?,?,?)'), insertToken = db.prepare('INSERT INTO tokens VALUES(?,?,?,?)'), insertKey = db.prepare('INSERT INTO search_keys VALUES(?,?,?,?)');
        for (const e of release.entries) {
            const address = { version: 2, sourceId: e.sourceId, sourceRevision: e.sourceRevision, passportRevision: e.passportRevision };
            const state = await reader.entry(address);
            for (const unit of state.descriptor.units) {
                stats.navigationUnits++;
                const key = bodyKey(unit);
                if (!bodies.has(key)) {
                    const body = await reader.body(state.entry, unit); // validates native hash/revision, including a reused posting
                    bodies.set(key, body); insertBody.run(key, unit.bodyId, unit.bodyRevision, body.raw.length, Number(!!body.chant));
                    const prior = reuseCompatible && old!.db.prepare('SELECT 1 FROM bodies WHERE body_key=?').get(key);
                    if (prior) {
                        for (const r of old!.db.prepare('SELECT * FROM tokens WHERE body_key=? ORDER BY position').all(key) as Obj[]) insertToken.run(key, r.position, r.token_id, r.payload);
                        for (const r of old!.db.prepare('SELECT * FROM search_keys WHERE body_key=? ORDER BY position,key').all(key) as Obj[]) insertKey.run(r.key, key, r.position, r.match_kind);
                        stats.reusedBodies++;
                    } else {
                        // Projection has a 64K read window; pilot bodies are checked here, never silently truncated.
                        const projection = project(body, profileSets[0].id);
                        let position = 0;
                        for (const token of projection.tokens.filter(lexical)) {
                            insertToken.run(key, position, token.tokenId, canonical(token));
                            for (const k of token.searchKeys) insertKey.run(k.value, key, position, k.matchKind);
                            position++; // blocked lexical tokens are barriers, not removed from phrase positions
                        }
                    }
                }
                const alias = { address: { ...address, selector: { kind: 'occurrence', occurrenceId: unit.occurrenceId } }, source: e.source, nativeKind: e.nativeRef.kind, placement: unit.placement, repeatCount: unit.repeatCount ?? 1 };
                const existing = placements.get(unit.occurrenceId);
                if (existing) {
                    if (existing.bodyKey !== key) throw Error('One occurrence has conflicting bodies');
                    existing.aliases.push(alias);
                } else placements.set(unit.occurrenceId, { occurrenceId: unit.occurrenceId, bodyKey: key, ordinal: placements.size, aliases: [alias] });
            }
        }
        for (const p of placements.values()) {
            p.aliases.sort((a: Obj, b: Obj) => Number(a.nativeKind === 'chant') - Number(b.nativeKind === 'chant') || a.address.sourceId.localeCompare(b.address.sourceId));
            db.prepare('INSERT INTO placements VALUES(?,?,?,?)').run(p.occurrenceId, p.bodyKey, p.ordinal, canonical(p));
        }
        const candidateCache = new Map<string, Obj[]>();
        const insertCandidate = db.prepare('INSERT INTO candidates VALUES(?,?,?,?)');
        for (const row of db.prepare('SELECT * FROM tokens ORDER BY body_key,position').all() as Obj[]) {
            const token = JSON.parse(row.payload), key = token.lookupKey?.value;
            stats.tokens++; if (token.searchKeys.length) stats.searchableTokens++; else stats.blockedTokens++;
            if (!key || key.length > 80) continue;
            if (!candidateCache.has(key)) {
                const found = options.dictionary.search(key, 'cu-ru', 0, 5);
                candidateCache.set(key, found.items.filter(h => h.exact).map(h => ({ lexemeId: h.id, label: h.name, matched: h.matched, basis: h.match, dictionaryVersion: options.dictionary.version, reviewStatus: 'unreviewed' })));
            }
            for (const c of candidateCache.get(key)!) { insertCandidate.run(row.body_key, row.position, c.lexemeId, canonical(c)); stats.candidateLinks++; }
        }
        const seenReviews = new Set<string>();
        for (const review of [...(options.reviews ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
            if (seenReviews.has(review.id)) throw Error('Duplicate review id'); seenReviews.add(review.id);
            const placement = placements.get(review.occurrenceId), key = bodyKey(review), body = bodies.get(key);
            if (!placement || placement.bodyKey !== key || !body || review.dictionaryVersion !== options.dictionary.version || !review.reviewer?.trim() || !review.rationale?.trim()) throw Error('Unbound or incomplete review');
            if (!placement.aliases.some((a: Obj) => a.address.sourceId === review.sourceId && a.address.sourceRevision === review.sourceRevision)) throw Error('Review source mismatch');
            const tokens = (db.prepare('SELECT * FROM tokens WHERE body_key=? ORDER BY position').all(key) as Obj[]).filter(t => review.tokenIds.includes(t.token_id));
            if (!tokens.length || canonical(tokens.map(t => t.token_id)) !== canonical(review.tokenIds) || tokens.some((t, i) => i > 0 && t.position !== tokens[i - 1].position + 1)) throw Error('Review tokens missing, reordered or non-contiguous');
            const rawRanges = tokens.flatMap(t => JSON.parse(t.payload).rawRanges);
            if (canonical(rawRanges) !== canonical(review.rawRanges) || sha(rawRanges.map((r: number[]) => body.raw.slice(...r as [number, number])).join('')) !== review.quoteSha256) throw Error('Review evidence mismatch');
            const article = options.dictionary.article(review.lexemeId);
            if (!article || !review.dictionarySourceIds.length || review.dictionarySourceIds.some(id => !article.sources.some(s => s.id === id) || !options.dictionary.source(id))) throw Error('Review dictionary evidence unavailable');
            if (review.decision !== 'accepted' && review.decision !== 'rejected') throw Error('Invalid review decision');
            db.prepare('INSERT INTO reviews VALUES(?,?,?,?)').run(review.id, review.occurrenceId, review.lexemeId, canonical(review));
            if (review.decision === 'accepted') {
                if (tokens.some(t => !JSON.parse(t.payload).lookupKey)) throw Error('Blocked token cannot be accepted');
                const overlap = db.prepare('SELECT 1 FROM accepted_links WHERE occurrence_id=? AND position<=? AND end_position>=?').get(review.occurrenceId, tokens.at(-1)!.position, tokens[0].position);
                if (overlap) throw Error('Conflicting accepted links require a single explicit decision');
                db.prepare('INSERT INTO accepted_links VALUES(?,?,?,?,?)').run(review.occurrenceId, tokens[0].position, tokens.at(-1)!.position, review.lexemeId, review.id); stats.acceptedLinks++;
            }
        }
        stats.bodies = bodies.size; stats.placements = placements.size;
        const content = { format: INDEX_RULES.format, pilotId: PILOT, corpusRelease: release._id, dictionaryVersion: options.dictionary.version, bodyRevisions: [...bodies.values()].map(b => ({ bodyId: b.bodyId, bodyRevision: b.bodyRevision })).sort((a, b) => bodyKey(a).localeCompare(bodyKey(b))), profileFingerprints: profileFingerprints(), rules: INDEX_RULES, tableHashes: Object.fromEntries(tables.map(t => [t, tableHash(db, t)])), coverage: { ...stats, reusedBodies: undefined } };
        delete content.coverage.reusedBodies;
        const manifest = { ...content, indexRevision: revision('ix1', content) };
        db.prepare('INSERT INTO manifest VALUES(1,?)').run(canonical(manifest));
        db.exec('VACUUM'); db.close();
        const target = join(options.outputDir, `corpus-index-${manifest.indexRevision}.sqlite`);
        if (existsSync(target)) { if (sha(readFileSync(target)) !== sha(readFileSync(temporary))) throw Error('Immutable index collision'); unlinkSync(temporary); }
        else { chmodSync(temporary, 0o444); renameSync(temporary, target); }
        completed = true;
        return { path: target, sha256: sha(readFileSync(target)), manifest, buildStats: stats };
    } finally { if (db.open) db.close(); old?.db.close(); if (!completed && existsSync(temporary)) unlinkSync(temporary); }
}
export function configuredIndex(requested?: string) {
    const active = process.env.CS_CORPUS_INDEX_DB;
    if (!active) fail('index_unavailable', 503, 'Индекс пилота ещё не опубликован.');
    if (requested && !/^ix1_[a-f0-9]{64}$/.test(requested)) fail('invalid_request', 400, 'Неверная ревизия индекса.');
    let index: ReturnType<typeof openIndex>;
    try {
        index = openIndex(active);
        if (requested && index.manifest.indexRevision !== requested) {
            index.db.close();
            const directory = process.env.CS_CORPUS_INDEX_ARCHIVE_DIR ?? dirname(active);
            if (existsSync(join(directory, `retired-${requested}.json`))) fail('index_retired', 410, 'Индекс явно выведен из обращения.');
            index = openIndex(join(directory, `corpus-index-${requested}.sqlite`));
            if (index.manifest.indexRevision !== requested) { index.db.close(); throw Error('Wrong archive'); }
        }
        const directory = process.env.CS_CORPUS_INDEX_ARCHIVE_DIR ?? dirname(active);
        if (existsSync(join(directory, `retired-${index.manifest.indexRevision}.json`))) { index.db.close(); fail('index_retired', 410, 'Индекс явно выведен из обращения.'); }
        return index;
    } catch (error: any) { if (error?.code === 'index_retired') throw error; fail('index_revision_unavailable', 409, 'Индекс недоступен; выберите опубликованный снимок.'); }
}
