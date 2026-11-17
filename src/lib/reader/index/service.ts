import type Database from 'better-sqlite3';
import { canonical, cursorEncode, fail, limit, PILOT, ReaderError, sha, utf16, type Obj } from '../core';
import { profile, project } from '../projection';
import type { ReaderService } from '../service';
import { bodyKey, configuredIndex, hitId, INDEX_CONTRACT, INDEX_LIMITS, INDEX_PROFILE_IDS, lexical, openIndex, profileFingerprints } from './store';

type Snapshot = ReturnType<typeof openIndex>;
function queryTokens(q: string, mode: string, profileSetId: string): Obj[] {
    if (typeof q !== 'string' || !q.trim() || q.length > INDEX_LIMITS.queryMaxUtf16) fail('invalid_request', 400, 'Нужен запрос до 200 знаков UTF-16.');
    utf16(q);
    // Query is plain text, not reader markup: reject markup syntax rather than interpret it.
    if (/[<>\[\]]/u.test(q)) fail('invalid_request', 400, 'Запрос должен содержать слова, а не разметку.');
    const tokens = project({ bodyId: 'query', bodyRevision: 'br1_' + sha(q), raw: q, chant: true }, profileSetId).tokens.filter(lexical);
    if (tokens.some((t: Obj) => t.flags.includes('unresolved_glyph') || t.blockedReason)) fail('unresolved_query_glyph', 422, 'Запрос содержит нераспознанный знак.');
    if (!tokens.length || tokens.some((t: Obj) => !t.searchKeys.length) || mode === 'word' && tokens.length !== 1 || mode === 'phrase' && (tokens.length < 2 || tokens.length > INDEX_LIMITS.phraseMaxTokens)) fail('invalid_request', 400, 'Нужно одно слово или фраза из 2–12 слов.');
    return tokens;
}
export class CorpusIndexService {
    constructor(readonly reader: ReaderService, readonly load: (revision?: string) => Snapshot = configuredIndex) { }
    async context(index: Snapshot) {
        const m = index.manifest;
        if (m.pilotId !== PILOT || canonical(m.profileFingerprints) !== canonical(profileFingerprints())) fail('index_incompatible', 409, 'Профили индекса несовместимы с сервером.');
        const states = new Map<string, Obj>();
        const all = index.db.prepare('SELECT * FROM placements ORDER BY ordinal').all() as Obj[];
        const placements = new Map<string, Obj>(), bodies = new Map<string, Obj>();
        for (const row of all) {
            const p = JSON.parse(row.payload), aliases: Obj[] = [];
            for (const alias of p.aliases) {
                const id = alias.address.sourceId;
                if (!states.has(id)) {
                    try { states.set(id, await this.reader.entry(alias.address)); }
                    catch (e) { if (e instanceof ReaderError && e.status === 404) states.set(id, { hidden: true }); else throw e; }
                }
                if (!states.get(id)!.hidden) aliases.push(alias);
            }
            if (!aliases.length) continue;
            const state = states.get(aliases[0].address.sourceId)!;
            const unit = state.descriptor.units.find((u: Obj) => u.occurrenceId === p.occurrenceId && bodyKey(u) === p.bodyKey);
            if (!unit) fail('index_stale', 409, 'Размещение индекса недоступно в reader.');
            if (!bodies.has(p.bodyKey)) {
                try { bodies.set(p.bodyKey, await this.reader.body(state.entry, unit)); }
                catch (e) { if (e instanceof ReaderError && [409, 410].includes(e.status)) fail('index_stale', 409, 'Исходная ревизия текста недоступна; нужна пересборка индекса.'); throw e; }
            }
            placements.set(p.occurrenceId, { ...p, aliases });
        }
        return { placements, bodies, visibility: sha(canonical([...states.entries()].map(([id, s]) => [id, !s.hidden]).sort())) };
    }
    async capabilities() {
        if (!process.env.CS_CORPUS_INDEX_DB && this.load === configuredIndex) return { available: false, contract: INDEX_CONTRACT, pilotId: PILOT, publicRead: false, reason: 'not_published' };
        const index = this.load();
        try {
            const context = await this.context(index);
            const visibleBodies = new Set([...context.placements.values()].map(p => p.bodyKey));
            const sourceIds = new Set([...context.placements.values()].flatMap(p => p.aliases.map((a: Obj) => a.address.sourceId)));
            return { available: true, pilotId: PILOT, indexRevision: index.manifest.indexRevision, corpusRelease: index.manifest.corpusRelease, dictionaryVersion: index.manifest.dictionaryVersion, profiles: index.manifest.profileFingerprints, limits: INDEX_LIMITS, matchKinds: ['folded', 'abbreviation_skeleton', 'lexeme_verified'], verifiedLexemeCoverage: 'partial', profileLimitations: ['Source/unicode profiles supported; letterfold token identity differs on pilot PUA and is excluded from the index.'], coverage: { navigationMaterials: sourceIds.size, placements: context.placements.size, bodies: visibleBodies.size }, publicRead: process.env.CS_READER_PUBLIC_PILOT === '1', ratePolicy: { id: 'reader-public-pilot-r1', aggregatePerMinute: 120, searchAndOccurrencesPerMinute: 30, lookupPerMinute: 30, storage: 'single-process' }, sourceRights: 'per-source; no automatic license grant', bulkExport: false };
        } finally { index.db.close(); }
    }
    async search(query: Obj) { return this.query(query, false); }
    async occurrences(query: Obj) { return this.query(query, true); }
    private async query(query: Obj, lemma: boolean) {
        const allowed = ['pilotId', 'indexRevision', 'profileSetId', 'limit', 'cursor', ...(lemma ? ['lexemeId', 'dictionaryVersion'] : ['mode', 'q'])];
        if (Object.keys(query).some(k => !allowed.includes(k))) fail('invalid_request', 400, 'Неизвестный параметр.');
        if (query.pilotId !== PILOT) fail('not_found', 404, 'Неизвестный пилот.');
        const ps = profile(query.profileSetId); if (!INDEX_PROFILE_IDS.includes(ps.id)) fail('unsupported_profile', 422, 'Профиль не поддержан этой публикацией индекса.', { supported: INDEX_PROFILE_IDS }); const size = limit(query.limit, 20, 50);
        if (query.cursor && !query.indexRevision) fail('cursor_mismatch', 409, 'Для продолжения закрепите индекс.');
        let cursor: Obj | undefined;
        if (query.cursor) {
            try { if (query.cursor.length > 4096 || !/^[a-zA-Z0-9_-]+$/.test(query.cursor)) throw Error(); cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')); if (!cursor || !Number.isSafeInteger(cursor.offset) || cursor.offset < 1 || cursor.offset >= INDEX_LIMITS.traversalMax) throw Error(); }
            catch { fail('invalid_request', 400, 'Курсор не прочитан.'); }
        }
        const index = this.load(query.indexRevision);
        try {
            const m = index.manifest;
            if (lemma && (typeof query.lexemeId !== 'string' || !query.lexemeId.length || query.lexemeId.length > 200 || typeof query.dictionaryVersion !== 'string')) fail('invalid_request', 400, 'Нужны lexemeId и версия словаря карточки.');
            if (lemma && query.dictionaryVersion !== m.dictionaryVersion) fail('dictionary_version_mismatch', 409, 'Индекс не связан с этой версией словаря.', { dictionaryVersion: m.dictionaryVersion });
            if (!lemma && !['word', 'phrase'].includes(query.mode)) fail('invalid_request', 400, 'Неверный режим поиска.');
            const qt = lemma ? [] : queryTokens(query.q, query.mode, ps.id);
            const context = await this.context(index);
            const affinity = sha(canonical({ I: m.indexRevision, C: m.corpusRelease, D: m.dictionaryVersion, P: ps.id, query: lemma ? { lexemeId: query.lexemeId } : { mode: query.mode, q: query.q }, size, visibility: context.visibility }));
            if (cursor && cursor.affinity !== affinity) fail('cursor_mismatch', 409, 'Курсор относится к другой выдаче или видимости.');
            const ids = [...context.placements.keys()];
            // Native pilot has <=256 placements. Bound work before returning results, with a 501st observation.
            let rows: Obj[] = [];
            if (ids.length) {
                const visible = ids.map(() => '?').join(',');
                if (lemma) rows = index.db.prepare(`SELECT p.*,a.position,a.end_position,a.review_id,'lexeme_verified' match_kind FROM accepted_links a JOIN placements p ON p.occurrence_id=a.occurrence_id WHERE a.lexeme_id=? AND p.occurrence_id IN (${visible}) ORDER BY p.ordinal,a.position LIMIT 501`).all(query.lexemeId, ...ids) as Obj[];
                else {
                    const checks = qt.slice(1).map((_, i) => `EXISTS(SELECT 1 FROM search_keys k${i} WHERE k${i}.body_key=k.body_key AND k${i}.position=k.position+${i + 1} AND k${i}.key=?)`).join(' AND ');
                    rows = index.db.prepare(`SELECT p.*,k.position,k.position+? end_position,k.match_kind FROM search_keys k JOIN placements p ON p.body_key=k.body_key WHERE k.key=? ${checks ? 'AND ' + checks : ''} AND p.occurrence_id IN (${visible}) ORDER BY p.ordinal,k.position LIMIT 501`).all(qt.length - 1, qt[0].searchKeys[0].value, ...qt.slice(1).map(t => t.searchKeys[0].value), ...ids) as Obj[];
                }
            }
            const tokens = (row: Obj) => (index.db.prepare('SELECT payload FROM tokens WHERE body_key=? AND position BETWEEN ? AND ? ORDER BY position').all(row.body_key, row.position, row.end_position) as Obj[]).map(t => JSON.parse(t.payload));
            const identity = (row: Obj) => hitId(row.occurrence_id, context.bodies.get(row.body_key)!, tokens(row).map(t => t.tokenId));
            const offset = cursor?.offset ?? 0;
            if (cursor && (!rows[offset - 1] || identity(rows[offset - 1]) !== cursor.lastHitId)) fail('cursor_mismatch', 409, 'Позиция курсора не подтверждается.');
            const hits: Obj[] = [];
            const result: Obj = { indexRevision: m.indexRevision, corpusRelease: m.corpusRelease, dictionaryVersion: m.dictionaryVersion, profileSetId: ps.id, hits, scope: 'searchable-pilot-only', association: lemma ? 'accepted-only' : 'surface-match-only', page: {} };
            const page = () => {
                const end = offset + hits.length, more = rows.length > end;
                result.page = { nextCursor: more && end < 500 ? cursorEncode({ affinity, offset: end, lastHitId: hits.at(-1)!.hitId }) : null, hasMore: more, truncated: more && end >= 500, total: rows.length > 500 ? { state: 'at_least', value: 501 } : { state: 'exact', value: rows.length } };
            };
            for (const row of rows.slice(offset, Math.min(offset + size, 500))) {
                const placement = context.placements.get(row.occurrence_id)!, body = context.bodies.get(row.body_key)!, ts = tokens(row);
                const alias = placement.aliases[0];
                const matchKind = lemma ? 'lexeme_verified' : ts.some(t => t.searchKeys.some((k: Obj) => k.matchKind === 'abbreviation_skeleton')) || qt.some(t => t.searchKeys[0].matchKind === 'abbreviation_skeleton') ? 'abbreviation_skeleton' : 'folded';
                const hit: Obj = { hitId: identity(row), address: alias.address, source: alias.source, bodyId: body.bodyId, bodyRevision: body.bodyRevision, occurrenceId: row.occurrence_id, tokenIds: ts.map(t => t.tokenId), rawRanges: ts.flatMap(t => t.rawRanges), matchKind, navigationAliases: placement.aliases.slice(1).map((a: Obj) => ({ address: a.address, source: a.source })), ...this.snippet(index.db, row, body, ts, ps.id) };
                if (lemma) {
                    const review = JSON.parse((index.db.prepare('SELECT payload FROM reviews WHERE id=?').get(row.review_id) as Obj).payload);
                    hit.lexemeId = query.lexemeId; hit.bindingEvidence = review;
                }
                hits.push(hit); page();
                if (Buffer.byteLength(JSON.stringify({ contract: INDEX_CONTRACT, data: result, warnings: [] })) > INDEX_LIMITS.maxResponseBytes) {
                    hits.pop();
                    if (!hits.length) fail('response_too_large', 413, 'Минимальное вхождение превышает бюджет ответа.');
                    break;
                }
            }
            page(); return result;
        } finally { index.db.close(); }
    }
    private snippet(db: Database.Database, row: Obj, body: Obj, tokens: Obj[], ps: string) {
        const start = tokens[0].rawRanges[0][0], end = tokens.at(-1)!.rawRanges.at(-1)[1];
        if (end - start > 512) return { snippet: null, snippetStatus: 'match_exceeds_budget' };
        const nearby = (db.prepare('SELECT position,payload FROM tokens WHERE body_key=? AND position BETWEEN ? AND ? ORDER BY position').all(row.body_key, Math.max(0, row.position - 6), row.end_position + 6) as Obj[]).map(t => ({ position: t.position, token: JSON.parse(t.payload) }));
        let a = 0, b = nearby.length - 1;
        const left = () => nearby[a].token.rawRanges[0][0], right = () => nearby[b].token.rawRanges.at(-1)[1];
        while (right() - left() > 512) { if (nearby[b].position > row.end_position) b--; else if (nearby[a].position < row.position) a++; else return { snippet: null, snippetStatus: 'match_exceeds_budget' }; }
        return { snippet: project(body, ps, [left(), right()]), snippetStatus: 'available' };
    }
}
