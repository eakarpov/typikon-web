import { civilKey } from '@/lib/cslav/core';
import type { FusedComponent, LegacyLexeme, RecoveryLexeme } from './model';

export const encliticComponent = (form: string, lexemes: LegacyLexeme[]): FusedComponent => {
    const matches: { lexeme: LegacyLexeme; grammar: string }[] = [];
    for (const l of lexemes) {
        const found = (l.forms ?? []).find(f => civilKey(f.value) === civilKey(form));
        if (found || (l.name && civilKey(l.name) === civilKey(form))) matches.push({ lexeme: l, grammar: found?.properties ?? '' });
    }
    // Prefer an explicit source analysis of a short/clitic form, without word-specific rules.
    const cliticAnalyses = matches.filter(m => m.grammar.split(/[|,\/]/).includes('clit'));
    const preferred = cliticAnalyses.length ? cliticAnalyses : matches;
    const unique = preferred.length === 1 ? preferred[0] : null;
    return { role: 'enclitic', lookupForm: form, lexemeId: unique?.lexeme._id ?? null,
        candidateIds: preferred.map(m => m.lexeme._id), lemma: unique?.lexeme.name ?? undefined,
        grammar: unique?.grammar };
};
export const addComposition = (row: RecoveryLexeme, all: RecoveryLexeme[], legacy: LegacyLexeme[]): RecoveryLexeme => {
    const key = row.externalKey.replace(/:$/, '');
    if (!key.includes('+')) return row;
    const [base, ...particles] = key.split('+');
    const sourceBase = all.find(r => r.externalKey === base + ':');
    const existing = legacy.filter(l => l.name && civilKey(l.name) === civilKey(base));
    const baseId = sourceBase?._id ?? (existing.length === 1 ? existing[0]._id : null);
    return { ...row, composition: { kind: 'enclitic-combination', placement: 'form-specific', reviewStatus: 'reviewed',
        evidenceIds: [row.sourceEntryId], components: [
            { role: 'base', lookupForm: sourceBase?.name ?? base, externalKey: base + ':', lexemeId: baseId,
                candidateIds: baseId ? [baseId] : existing.map(l => l._id) },
            ...particles.map(p => encliticComponent(p, legacy)),
        ] } };
};
