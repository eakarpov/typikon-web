/** Local, read-only with respect to typikon-web data. Produces a new staging SQLite. */
import { createReadStream, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { BSON } from 'mongodb';
import Database from 'better-sqlite3';
import { digest, DslParser, fragments, grammarEvidence, lemmaHeader, lemmaProperties, LexemeMatcher, recoverYa } from '@/lib/dictionaryImport/core';
import { SOURCE_CATALOG } from '@/lib/dictionaryImport/sources';
import type { DslEntry, LegacyLexeme, GrammarEvidence } from '@/lib/dictionaryImport/model';

const option = (name: string): string | undefined => {
    const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1];
};
const required = (name: string): string => {
    const value = option(name); if (!value || value.startsWith('--')) throw new Error(`Required: ${name}`); return resolve(value);
};
const loadLexemes = (file: string): LegacyLexeme[] => {
    const raw = readFileSync(file);
    if (!file.endsWith('.bson')) return JSON.parse(raw.toString('utf8')) as LegacyLexeme[];
    const docs: LegacyLexeme[] = [];
    for (let p = 0; p < raw.length;) {
        const size = raw.readInt32LE(p);
        if (size < 5 || p + size > raw.length) throw new Error('Invalid BSON boundary');
        docs.push(JSON.parse(JSON.stringify(BSON.deserialize(raw.subarray(p, p + size)))) as LegacyLexeme); p += size;
    }
    return docs;
};
async function main(): Promise<void> {
    const dsl = required('--dsl'), snapshot = required('--lexems'), out = required('--out');
    if (existsSync(out)) throw new Error(`Output exists; choose a new path: ${out}`);
    const prefix = readFileSync(dsl).subarray(0, 2);
    const fileStream = createReadStream(dsl);
    const input = prefix[0] === 0x1f && prefix[1] === 0x8b
        ? fileStream.pipe(createGunzip()) : fileStream;
    if (input !== fileStream) fileStream.on('error', error => input.destroy(error));
    const lexemes = loadLexemes(snapshot), matcher = new LexemeMatcher(lexemes);
    // SHA of raw bytes, not of decoded/reformatted dictionary records.
    const { createHash } = await import('node:crypto');
    const fileSha256 = createHash('sha256').update(readFileSync(dsl)).digest('hex');
    mkdirSync(dirname(out), { recursive: true });
    const db = new Database(out);
    db.pragma('journal_mode = DELETE');
    db.exec(`
        CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE baseline(id TEXT PRIMARY KEY, protectedHash TEXT NOT NULL);
        CREATE TABLE entries(id TEXT PRIMARY KEY,headers TEXT NOT NULL,body TEXT NOT NULL,line INTEGER NOT NULL,endLine INTEGER NOT NULL);
        CREATE TABLE locations(line INTEGER PRIMARY KEY,entryId TEXT NOT NULL);
        CREATE TABLE fragments(id TEXT PRIMARY KEY,entryId TEXT NOT NULL,sourceCode TEXT NOT NULL,ordinal INTEGER NOT NULL,raw TEXT NOT NULL);
        CREATE TABLE sources(code TEXT PRIMARY KEY, title TEXT, url TEXT, rightsStatus TEXT NOT NULL DEFAULT 'unresolved');
        CREATE TABLE grammar(target TEXT NOT NULL,form TEXT NOT NULL,properties TEXT NOT NULL,analysis TEXT NOT NULL,sourceEntryId TEXT NOT NULL);
        CREATE INDEX grammar_target ON grammar(target);
        CREATE TABLE links(externalKey TEXT PRIMARY KEY,lexemeId TEXT,candidateIds TEXT NOT NULL,method TEXT NOT NULL,reviewStatus TEXT NOT NULL);
        CREATE TABLE recovery(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
    `);
    const meta = db.prepare('INSERT INTO metadata VALUES (?,?)');
    meta.run('state', 'building'); meta.run('defaultIzvod', 'russian-synodal'); meta.run('sourceFileSha256', fileSha256);
    meta.run('sourceFile', dsl); meta.run('lexemeSnapshot', snapshot);
    meta.run('snapshotSha256', createHash('sha256').update(readFileSync(snapshot)).digest('hex'));
    meta.run('policy', 'Evidence only; preserve all existing lexical fields; links are proposals; no automatic publication');
    const baseline = db.prepare('INSERT INTO baseline VALUES (?,?)');
    db.transaction(() => { for (const l of lexemes) baseline.run(l._id, digest(JSON.stringify(l))); })();
    const putEntry = db.prepare('INSERT OR IGNORE INTO entries VALUES (?,?,?,?,?)');
    const putLocation = db.prepare('INSERT INTO locations VALUES (?,?)');
    const putFragment = db.prepare('INSERT OR IGNORE INTO fragments VALUES (?,?,?,?,?)');
    const putSource = db.prepare('INSERT OR IGNORE INTO sources(code) VALUES (?)');
    const putGrammar = db.prepare('INSERT INTO grammar VALUES (?,?,?,?,?)');
    const putLink = db.prepare('INSERT INTO links VALUES (?,?,?,?,?)');
    const lemmas: DslEntry[] = [], sourceHeads = new Map<string, string>();
    let batch: DslEntry[] = [], articles = 0;
    const save = db.transaction((items: DslEntry[]) => {
        for (const e of items) {
            const inserted = putEntry.run(e.id, JSON.stringify(e.headers), e.body, e.line, e.endLine).changes;
            putLocation.run(e.line, e.id); articles++;
            for (const h of e.headers) if (!sourceHeads.has(h)) sourceHeads.set(h, e.id);
            if (!inserted) continue;
            for (const f of fragments(e)) {
                putSource.run(f.sourceCode); putFragment.run(f.id, f.entryId, f.sourceCode, f.ordinal, f.raw);
            }
            for (const g of grammarEvidence(e)) putGrammar.run(g.target, g.form, g.properties, g.analysis, g.sourceEntryId);
            const header = lemmaHeader(e);
            if (header) {
                lemmas.push(e); const link = matcher.match(header, lemmaProperties(e));
                putLink.run(header, link.lexemeId, JSON.stringify(link.candidateIds), link.method, link.reviewStatus);
            }
        }
    });
    const parser = new DslParser();
    try {
        const lines = createInterface({ input, crlfDelay: Infinity });
        let readError: Error | null = null;
        input.on('error', (error: Error) => { readError = error; lines.close(); });
        for await (const line of lines) {
            if (line.includes('\u0000')) throw new Error('UTF-16 DSL is not supported; explicitly decode to UTF-8 first');
            const e = parser.push(line); if (e) batch.push(e);
            if (batch.length >= 1000) { save(batch); batch = []; }
        }
        if (readError) throw readError;
        const last = parser.end(); if (last) batch.push(last); save(batch);
        if (!articles || lemmas.length < 100) throw new Error('Incomplete dictionary input');
        const getForms = db.prepare('SELECT target,form,properties,analysis,sourceEntryId FROM grammar WHERE target=?');
        const recoveries = lemmas.flatMap(e => {
            const h = lemmaHeader(e) ?? '';
            if (!h.startsWith('я')) return [];
            const forms = getForms.all(h) as GrammarEvidence[];
            const recovered = recoverYa(e, forms, matcher, sourceHeads); return recovered ? [recovered] : [];
        });
        const putRecovery = db.prepare('INSERT INTO recovery VALUES (?,?)');
        db.transaction(() => { for (const r of recoveries) putRecovery.run(r._id, JSON.stringify(r)); })();
        const describeSource = db.prepare('UPDATE sources SET title=?,url=? WHERE code=?');
        for (const [code, source] of Object.entries(SOURCE_CATALOG)) describeSource.run(source.title, source.url, code);
        db.prepare('UPDATE metadata SET value=? WHERE key=?').run('complete', 'state');
        const scalar = (sql: string): number => (db.prepare(sql).get() as { n: number }).n;
        const summary = { sourceFileSha256: fileSha256, articles, uniqueEntries: scalar('SELECT count(*) n FROM entries'),
            fragments: scalar('SELECT count(*) n FROM fragments'), lemmaLinks: scalar('SELECT count(*) n FROM links'),
            linking: db.prepare('SELECT method,count(*) count FROM links GROUP BY method').all(),
            recovery: { lexemes: recoveries.length, forms: recoveries.reduce((n,r) => n+r.forms.length,0),
                churchAttested: recoveries.filter(r=>r.orthographyStatus==='source-attested').length,
                schemeUnassigned: recoveries.filter(r=>r.morphologyStatus==='unassigned').length },
            existingLexemesModified: 0, out };
        writeFileSync(out + '.recovery-ya.json', JSON.stringify(recoveries, null, 2) + '\n');
        writeFileSync(out + '.summary.json', JSON.stringify(summary, null, 2) + '\n');
        console.log(JSON.stringify(summary, null, 2));
    } finally { db.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Import preparation failed'); process.exitCode = 1; });
