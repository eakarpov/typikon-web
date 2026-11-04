import { digest, LexemeMatcher } from './core';
import type { LegacyLexeme, RecoveryLexeme, LexemeLink } from './model';
export const stable = (value: unknown): string => {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.entries(value as Record<string,unknown>)
        .filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',') + '}';
    return JSON.stringify(value) ?? 'null';
};
export const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const fingerprint = (rows: LegacyLexeme[]): string => digest(stable(plain(rows).slice().sort((a,b)=>a._id.localeCompare(b._id))));
export interface DictionaryImportPlan {
    formatVersion: 1;
    id: string;
    sourceVersion: string;
    stagingSha256: string;
    recoverySha256: string;
    targetDatabase: 'typikon-csl';
    baseline: { count: number; fingerprint: string };
    requiredRuntimeCapability: 'dictionary-morphology-lemma-v1';
    insertions: RecoveryLexeme[];
    existing: {externalKey:string;lexemeId:string}[];
    held: {externalKey:string;reasons:string[]}[];
    links: LexemeLink[];
}
export const planRecovery = (legacy: LegacyLexeme[], recovery: RecoveryLexeme[]): Pick<DictionaryImportPlan,'insertions'|'existing'|'held'> => {
    const insertions: RecoveryLexeme[] = [], existing: DictionaryImportPlan['existing'] = [], held: DictionaryImportPlan['held'] = [];
    const matcher = new LexemeMatcher(legacy), ids = new Map(legacy.map(l=>[l._id,l]));
    for(const row of recovery){
        const sameId=ids.get(row._id);
        if(sameId){held.push({externalKey:row.externalKey,reasons:['ID already exists; inspect provenance before reuse']});continue;}
        const match=matcher.match(row.externalKey,row.properties);
        if(match.lexemeId){existing.push({externalKey:row.externalKey,lexemeId:match.lexemeId});continue;}
        const reasons:string[]=[];
        if(match.candidateIds.length)reasons.push('Possible existing homonym or spelling; no automatic merge');
        if(!['source-attested','editorial-reviewed'].includes(row.orthographyStatus))reasons.push('Church orthography not reviewed');
        if(row.morphologyStatus==='unassigned')reasons.push('Scheme remains undetermined');
        if(row.morphologyStatus==='reconstructed'&&(!row.scheme||!row.schemeEvidence||row.schemeEvidence.checkedForms!==row.schemeEvidence.matchedForms))reasons.push('Incomplete scheme evidence');
        if(row.composition)reasons.push('Fused-form composition requires article links and a form-specific renderer');
        if(reasons.length)held.push({externalKey:row.externalKey,reasons});else insertions.push(plain(row));
    }
    return {insertions,existing,held};
};
export const buildPlan = (legacy: LegacyLexeme[], recovery: RecoveryLexeme[], lemmaInputs: {key:string;properties:string}[],
    sourceVersion:string,stagingSha256:string,recoverySha256:string): DictionaryImportPlan => {
    const selected=planRecovery(legacy,recovery);
    const all:LegacyLexeme[]=[...legacy,...selected.insertions];
    const matcher=new LexemeMatcher(all);
    const data:Omit<DictionaryImportPlan,'id'>={formatVersion:1,sourceVersion,stagingSha256,recoverySha256,targetDatabase:'typikon-csl',
        baseline:{count:legacy.length,fingerprint:fingerprint(legacy)},requiredRuntimeCapability:'dictionary-morphology-lemma-v1',
        ...selected,links:lemmaInputs.map(l=>matcher.match(l.key,l.properties))};
    return {id:digest(stable(data)),...data};
};
export const validatePlanId = (plan: DictionaryImportPlan): void => {
    const {id,...data}=plan;if(digest(stable(data))!==id)throw new Error('Plan checksum mismatch');
};
/** Supports an explicit resume only for exact documents created by this plan. */
export const assertCurrent = (plan: DictionaryImportPlan, current: (LegacyLexeme & {dictionaryImportPlanId?:string})[]): void => {
    const owned=new Map(plan.insertions.map(r=>[r._id,r]));
    const baseline:LegacyLexeme[]=[];
    for(const row of plain(current)){
        const insertion=owned.get(row._id);
        if(!insertion){baseline.push(row);continue;}
        if(row.dictionaryImportPlanId!==plan.id)throw new Error('Insertion ID collision in current database');
        const {_id,...actual}=row;const {dictionaryImportPlanId,...content}=actual;
        const {_id:expectedId,...expected}=insertion;
        if(stable(content)!==stable(expected))throw new Error('Previously inserted record was edited; refusing resume');
    }
    if(baseline.length!==plan.baseline.count||fingerprint(baseline)!==plan.baseline.fingerprint)
        throw new Error('Current lexems differ from the reviewed snapshot; prepare a fresh plan');
};
