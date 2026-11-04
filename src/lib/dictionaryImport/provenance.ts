import Database from 'better-sqlite3';
import { digest } from './core';
import { stable } from './plan';
import type { LegacyLexeme } from './model';

export type ProvenanceKind = 'lexeme' | 'form' | 'sense' | 'scheme' | 'sense-candidate' | 'source-record';
export interface ProvenanceTarget {
    id: string; kind: ProvenanceKind; scope: 'current' | 'prepared' | 'source' | 'historical';
    lexemeId?: string; parentId?: string; value: unknown;
}
/** Carrier is where we acquired the data; reportedSource is not automatically a verified primary source. */
export interface ProvenanceEvidence {
    targetId: string; carrierVersionId: string; sourceId: string;
    reportedSourceId?: string; verifiedPrimarySourceId?: string;
    origin: 'dictionary' | 'reported-corpus' | 'corpus' | 'editorial' | 'generated' | 'unknown';
    attribution: 'exact-match' | 'reported' | 'reconstructed' | 'unknown';
    locator: Record<string, unknown>; reason?: string;
}
export const provenanceId = (kind: string, value: unknown): string => `${kind}:${digest(stable(value))}`;
export const lexemeTargetId = (id: string): string => `lexeme:${id}`;
// Exact Unicode spelling and grammatical tags are identity-bearing; never civil-normalize these keys.
export const formTargetId = (parentId: string, value: unknown, properties: unknown): string =>
    provenanceId('form', [parentId, value, properties]);
export const schemeTargetId = (parentId: string, code: unknown): string => provenanceId('scheme', [parentId, code]);
export interface CsvWitness { row: number; name: string; properties: string; scheme: string; forms: {value:string;properties?:string}[] }
export function matchLegacy(row: LegacyLexeme, candidates: CsvWitness[]): CsvWitness | undefined {
    if (!row.name || row.name === 'webmaster') return undefined;
    const exact = candidates.filter(c => c.name === row.name && c.properties === row.properties && c.scheme === row.scheme && stable(c.forms) === stable(row.forms ?? []));
    if (exact.length === 1) return exact[0];
    // A sole lemma/POS witness can support individual unchanged fields, but never overwrite edited fields.
    const same = candidates.filter(c => c.name === row.name && c.properties === row.properties);
    return same.length === 1 ? same[0] : undefined;
}
export function createProvenance(db: Database.Database): void {
    db.exec(`CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE sources(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE versions(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE targets(id TEXT PRIMARY KEY,kind TEXT NOT NULL,scope TEXT NOT NULL,lexemeId TEXT,parentId TEXT,payload TEXT NOT NULL);
      CREATE TABLE evidence(id TEXT PRIMARY KEY,targetId TEXT NOT NULL,sourceId TEXT NOT NULL,origin TEXT NOT NULL,attribution TEXT NOT NULL,payload TEXT NOT NULL);
      CREATE TABLE links(id TEXT PRIMARY KEY,fromId TEXT NOT NULL,toId TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL);
      CREATE INDEX provenance_lexeme ON targets(lexemeId); CREATE INDEX provenance_parent ON targets(parentId);
      CREATE INDEX provenance_evidence ON evidence(targetId); CREATE INDEX provenance_links_from ON links(fromId);
      CREATE INDEX provenance_links_to ON links(toId);`);
}
export function provenanceWriter(db: Database.Database) {
    const target = db.prepare('INSERT OR IGNORE INTO targets VALUES (@id,@kind,@scope,@lexemeId,@parentId,@payload)');
    const evidence = db.prepare('INSERT OR IGNORE INTO evidence VALUES (?,?,?,?,?,?)');
    const link = db.prepare('INSERT OR IGNORE INTO links VALUES (?,?,?,?,?)');
    return {
        target(t: ProvenanceTarget): string { target.run({...t,lexemeId:t.lexemeId??null,parentId:t.parentId??null,payload:stable(t)}); return t.id; },
        evidence(e: ProvenanceEvidence): void { evidence.run(provenanceId('evidence',e),e.targetId,e.sourceId,e.origin,e.attribution,stable(e)); },
        link(fromId:string,toId:string,status:'proposed'|'reviewed',detail:unknown): void {
            const payload={fromId,toId,status,detail};link.run(provenanceId('link',payload),fromId,toId,status,stable(payload));
        },
    };
}
/** Follow source mappings towards this article, never through it into other candidate articles. */
export function readProvenanceGraph(db: Database.Database, lexemeId: string): {targets:unknown[];evidence:unknown[];links:unknown[]} {
    const rows=db.prepare(`WITH RECURSIVE reachable(id) AS (
      SELECT id FROM targets WHERE lexemeId=? UNION SELECT fromId FROM links JOIN reachable ON toId=reachable.id
      UNION SELECT targets.id FROM targets JOIN reachable ON targets.parentId=reachable.id)
      SELECT 'targets' category,t.payload FROM targets t JOIN reachable r ON t.id=r.id
      UNION ALL SELECT 'evidence',e.payload FROM evidence e JOIN reachable r ON e.targetId=r.id
      UNION ALL SELECT 'links',l.payload FROM links l WHERE l.fromId IN reachable AND l.toId IN reachable`).all(lexemeId) as {category:'targets'|'evidence'|'links';payload:string}[];
    const graph:{targets:unknown[];evidence:unknown[];links:unknown[]}={targets:[],evidence:[],links:[]};
    for(const row of rows)graph[row.category].push(JSON.parse(row.payload) as unknown);return graph;
}
export function readProvenance(db: Database.Database, lexemeId: string): unknown[] {
    return readProvenanceGraph(db,lexemeId).evidence;
}
export const PROVENANCE_COLLECTIONS: Record<string,string> = {
    sources:'dictionaryProvenanceSources',versions:'dictionaryProvenanceVersions',targets:'dictionaryProvenanceTargets',
    evidence:'dictionaryProvenanceEvidence',links:'dictionaryProvenanceLinks',
};
export function validateProvenance(db:Database.Database, plan:{id:string;sourceVersion:string;baseline:{fingerprint:string}}):void {
    const meta=Object.fromEntries((db.prepare('SELECT key,value FROM metadata').all() as {key:string;value:string}[]).map(r=>[r.key,r.value]));
    if(meta.formatVersion!=='1'||meta.state!=='complete'||meta.planId!==plan.id||meta.baselineFingerprint!==plan.baseline.fingerprint||meta.chuRusSha256!==plan.sourceVersion)
        throw new Error('Provenance is incomplete or belongs to a different reviewed plan');
}
