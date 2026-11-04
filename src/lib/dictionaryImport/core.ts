import { createHash } from 'node:crypto';
import { csCanonical, civilKey } from '@/lib/cslav/core';
import type { DslEntry, SourceFragment, GrammarEvidence, LegacyLexeme, LexemeLink, RecoveryLexeme, OrthographyVariant } from './model';

export const digest = (s: string): string => createHash('sha256').update(s).digest('hex');
export const isDslDirective = (line: string): boolean => /^#[A-Z_]+\s/.test(line);
export const sourceId = (code: string): string => `chu-rus:${code}`;
/** Native source keys retain accents, yat, i, omega and numbered homonyms. */
const exactKey = (s: string): string => csCanonical(s.toLowerCase().replace(/ї/g, 'і')).normalize('NFD')
    .replace(/\u0486/g, '').replace(/\u0300$/, '\u0301').normalize('NFC');
const externalName = (s: string): string => s.replace(/:$/, '').replace(/_\d+$/, '');
const pos = (s: string): string => s.split(',')[0].trim();

/** Streaming DSL state machine. Multiple header lines belong to one article. */
export class DslParser {
    private headers: string[] = [];
    private lines: string[] = [];
    private start = 0;
    private number = 0;
    private inComment = false;
    private finish(): DslEntry | null {
        if (!this.headers.length) return null;
        if (!this.lines.length) throw new Error(`DSL article at line ${this.start} has no body`);
        const body = this.lines.join('\n');
        const entry = { id: digest(JSON.stringify(['chu-rus', this.headers, body])), headers: this.headers,
            body, line: this.start, endLine: this.number - 1 };
        this.headers = []; this.lines = [];
        return entry;
    }
    push(input: string): DslEntry | null {
        this.number++;
        let line = input.replace(/^\uFEFF/, '');
        // DSL {{...}} comments may span lines. Preserve article markup verbatim otherwise.
        if (this.inComment) {
            const end = line.indexOf('}}');
            if (end < 0) return null;
            line = line.slice(end + 2); this.inComment = false;
        }
        line = line.replace(/\{\{.*?\}\}/g, '');
        const comment = line.indexOf('{{');
        if (comment >= 0) { line = line.slice(0, comment); this.inComment = true; }
        if (!line.trim() || isDslDirective(line)) return null;
        if (/^\s/.test(line)) {
            if (!this.headers.length) throw new Error(`DSL body without header at line ${this.number}`);
            this.lines.push(line); return null;
        }
        const previous = this.lines.length ? this.finish() : null;
        if (!this.headers.length) this.start = this.number;
        this.headers.push(line);
        return previous;
    }
    end(): DslEntry | null {
        if (this.inComment) throw new Error('Unclosed DSL comment');
        this.number++;
        return this.finish();
    }
}
export const references = (raw: string): string[] => [...raw.matchAll(/\[ref\]([^\n]*?)\[\/ref\]/g)].map(m => m[1]);
export const lemmaHeader = (e: DslEntry): string | null =>
    e.headers.length === 1 && e.headers[0].endsWith(':') ? e.headers[0] : null;
export const lemmaProperties = (e: DslEntry): string => {
    if (!lemmaHeader(e)) return '';
    return /\[p\]gr\[\/p\]\s*([^\[\n]+)/.exec(e.body)?.[1].trim() ?? '';
};
export const fragments = (e: DslEntry): SourceFragment[] => {
    const result: SourceFragment[] = [];
    let code = 'article', lines: string[] = [];
    const finish = () => {
        if (!lines.length) return;
        const raw = lines.join('\n');
        result.push({ id: digest(JSON.stringify([e.id, code, result.length, raw])), entryId: e.id,
            sourceCode: code, raw, ordinal: result.length }); lines = [];
    };
    for (const line of e.body.split('\n')) {
        const label = /\[p\]([^\[\]]+)\[\/p\]/.exec(line)?.[1];
        if (label) { finish(); code = label; }
        // Media is retained in raw DSL, not executed or rendered as a local file reference.
        lines.push(line);
    }
    finish(); return result;
};
export const grammarEvidence = (e: DslEntry): GrammarEvidence[] => {
    if (lemmaHeader(e)) return [];
    return e.body.split('\n').flatMap(line => {
        const m = /\[p\]gr\[\/p\]\s*\[ref\]([^\n]*?:)\[\/ref\]\s*([^;\n]*);\s*(.*?)(?:\[\/m\])?$/.exec(line);
        return m ? [{ target: m[1], properties: m[2].trim(), analysis: m[3].trim(),
            sourceEntryId: e.id, form: e.headers[0] }] : [];
    });
};
export class LexemeMatcher {
    private exact = new Map<string, LegacyLexeme[]>();
    private broad = new Map<string, LegacyLexeme[]>();
    private aliases = new Map<string, LegacyLexeme[]>();
    constructor(lexemes: LegacyLexeme[], variants: OrthographyVariant[] = []) {
        for (const l of lexemes) {
            if (!l.name || l.name === 'webmaster') continue;
            for (const [map, key] of [[this.exact, exactKey(l.name)], [this.broad, civilKey(l.name)]] as const) {
                const list = map.get(key) ?? []; list.push(l); map.set(key, list);
            }
        }
        const byId = new Map(lexemes.map(l => [l._id, l]));
        for (const variant of variants) {
            if (variant.scope !== 'lemma' || variant.reviewStatus !== 'verified' || !variant.evidenceIds.length) continue;
            const l = byId.get(variant.lexemeId); if (!l) continue;
            const k = JSON.stringify([variant.izvodId, exactKey(variant.value)]);
            const list = this.aliases.get(k) ?? [];
            if (!list.some(existing => existing._id === l._id)) list.push(l);
            this.aliases.set(k, list);
        }
    }
    match(externalKey: string, properties: string, izvodId = 'russian-synodal'): LexemeLink {
        const name = externalName(externalKey);
        const filter = (ls: LegacyLexeme[]) => properties ? ls.filter(l => pos(l.properties ?? '') === pos(properties)) : ls;
        const aliases = filter(this.aliases.get(JSON.stringify([izvodId, exactKey(name)])) ?? []);
        const exact = aliases.length ? aliases : izvodId === 'russian-synodal' ? filter(this.exact.get(exactKey(name)) ?? []) : [];
        const broad = filter(this.broad.get(civilKey(name)) ?? []);
        const numbered = /_\d+:$/.test(externalKey);
        const chosen = exact.length ? exact : broad;
        const certain = !numbered && exact.length === 1;
        return { externalKey, lexemeId: certain ? exact[0]._id : null,
            candidateIds: chosen.map(l => l._id), reviewStatus: 'proposed',
            method: numbered && chosen.length ? 'homonym-review' : certain ? (aliases.length ? 'verified-orthography' : 'exact') :
                chosen.length ? 'normalized-candidate' : 'unmatched' };
    }
}
/** Recovery uses actual source spellings; no guessed scheme or reconstructed accent. */
export const recoverYa = (entry: DslEntry, forms: GrammarEvidence[], matcher: LexemeMatcher,
    sourceHeads: Map<string, string>): RecoveryLexeme | null => {
    const externalKey = lemmaHeader(entry);
    if (!externalKey || !externalName(externalKey).startsWith('я')) return null;
    const properties = lemmaProperties(entry);
    if (matcher.match(externalKey, properties).candidateIds.length) return null;
    const wanted = exactKey(externalName(externalKey));
    const mainLine = entry.body.split('\n').find(line => !line.includes('[p]') && !line.includes('См.')) ?? '';
    const attested = references(mainLine).find(h => exactKey(h) === wanted);
    const name = attested ? csCanonical(attested) : csCanonical(externalName(externalKey));
    const dedup = new Map<string, RecoveryLexeme['forms'][number]>();
    for (const f of forms) {
        const value = csCanonical(f.form);
        dedup.set(JSON.stringify([value, f.analysis]), { value, properties: f.analysis === ':' ? '' : f.analysis, sourceProperties: f.analysis, sourceEntryId: f.sourceEntryId });
    }
    return { izvodId: 'russian-synodal', _id: digest(`chu-rus:recovery:${externalKey}`).slice(0, 24), externalKey, name,
        search: civilKey(name), scheme: '', properties, forms: [...dedup.values()],
        morphologyStatus: ['ADV', 'ADVPRO', 'CONJ', 'PART', 'PR', 'INTJ', 'PRED'].includes(pos(properties)) ? 'notApplicable' : 'unassigned',
        orthographyStatus: attested ? 'source-attested' : 'needs-review', sourceEntryId: entry.id,
        canonicalSourceEntryId: attested ? sourceHeads.get(attested) ?? entry.id : null };
};
