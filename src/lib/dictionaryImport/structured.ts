import { digest } from './core';

export interface ReferenceEvidence {
    id: string;
    entryId: string;
    kind: 'internal' | 'external' | 'bible' | 'media';
    target: string;
    offset: number;
}
/** These are source pointers, not asserted synonyms, etymologies or verified verse mappings. */
export const extractReferences = (entryId: string, raw: string): ReferenceEvidence[] =>
    [...raw.matchAll(/\[(ref|url|s)\]([\s\S]*?)\[\/\1\]/g)].map(m => ({
        id: digest(JSON.stringify([entryId, m.index, m[1], m[2]])), entryId,
        kind: m[1] === 'ref' ? 'internal' : m[1] === 's' ? 'media' : m[2].startsWith('bible_ref/') ? 'bible' : 'external',
        target: m[2], offset: m.index ?? 0,
    }));
export interface FrequencyEvidence {
    entryId: string;
    total: number | null;
    /** Source subcorpora can overlap; never derive total by summing them. */
    subcorpora: Record<string, number>;
    raw: string;
}
export const extractFrequency = (entryId: string, raw: string): FrequencyEvidence | null => {
    const at = raw.indexOf('[p]чс[/p]');
    if (at < 0) return null;
    const body = raw.slice(at + '[p]чс[/p]'.length).split('\n')[0];
    const number = /^\s*(\d+|\*)/.exec(body)?.[1];
    const subcorpora: Record<string, number> = {};
    for (const m of body.matchAll(/([^\s=\[\]]+)=([0-9]+)/g)) subcorpora[m[1]] = Number(m[2]);
    return { entryId, total: number && number !== '*' ? Number(number) : null, subcorpora, raw: body };
};
export const unlinkedGrammar = (raw: string): string[] => raw.split('\n')
    .filter(line => line.includes('[p]gr[/p]') && !line.includes('[ref]') && line.includes('⁺'));
