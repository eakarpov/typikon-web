import { PARADIGMS, NOM, ANIM } from '@/lib/morphology/paradigms';
import { CONJUGATIONS } from '@/lib/morphology/conjugations';
import { ADJECTIVES, PLEN, participleParadigm } from '@/lib/morphology/adjectives';
import { splitClitic } from '@/lib/morphology/stems';
import type { Segment } from './types';

type Spec = { stem: string; ending: string };
type Cells = Partial<Record<string, string[]>>;
type Stems = Record<number, string>;
type Adj = ReturnType<typeof participleParadigm>;
export type EndingInput = { name?: string | null; morphologyLemma?: string; scheme?: string | null; properties?: string | null };
export type EndingResult = { segments: Segment[] | null; reason: string };

// Match graphic equivalents, never discard ъ/ь, conflate е/ѣ or и/і, or strip й.
const key = (value: string): string => value.normalize('NFD')
    .replace(/[\u0300-\u0305\u0307-\u036f\u0483-\u0489]/g, '')
    .normalize('NFC').toLowerCase().replace(/ᲂу|ѹ|ꙋ/g, 'у')
    .replace(/[ѧꙗ]/g, 'я').replace(/є/g, 'е').replace(/[ѡѻᲂ]/g, 'о');
const abbreviated = (s: string): boolean => /[\u0483\u0487\u2de0-\u2dff\ua674-\ua67d]/u.test(s);
const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' });
const cuts = (s: string): number[] => [0, ...Array.from(graphemes.segment(s), g => g.index + g.segment.length)];
const buildSpec = (stems: Stems, template: string): Spec[] => {
    if (template.startsWith('=')) return [];
    const m = /^(\d)?(.*?)(\^)?$/.exec(template);
    if (!m) return [];
    const stem = stems[Number(m[1] || 1)];
    if (!stem) return [];
    const full = (stem + m[2]).replace(/([жшчщц])я/g, '$1а').replace(/([жшчщц])ю/g, '$1у');
    return [{ stem, ending: full.slice(stem.length) }];
};
const adjCells = (p: Adj, stems: Stems, full: boolean): Cells => {
    const cells = full ? p.plen : p.brev;
    return (typeof cells === 'function' ? cells(stems) : cells) as Cells;
};

/** Context is fixed for one lexeme. All candidates come from its exact cell. */
export function endingSegmenter(input: EndingInput) {
    const parts = splitClitic(input.morphologyLemma ?? input.name ?? '');
    const reflexive = /(с[яѧ])$/.exec(parts.head)?.[1] ?? '';
    const lemma = reflexive ? parts.head.slice(0, -reflexive.length) : parts.head;
    const tail = reflexive + parts.clitic;
    const scheme = input.scheme ?? '';
    const noun = PARADIGMS[scheme];
    const verb = CONJUGATIONS[scheme];
    const adjective = ADJECTIVES[scheme];
    const safeStems = (engine: { stems: (lemma: string) => Stems } | undefined): Stems | undefined => {
        try { return engine?.stems(lemma); } catch { return undefined; }
    };
    const nounStems = safeStems(noun);
    const verbStems = safeStems(verb);
    const adjStems = safeStems(adjective);
    const animate = (input.properties ?? '').split(',').includes('anim');
    const memo = new Map<string, Spec[]>();
    function specs(kind: string, slot: string, base?: string, seen = new Set<string>()): Spec[] {
        const id = JSON.stringify([kind, slot, base]);
        if (memo.has(id)) return memo.get(id)!;
        if (seen.has(id)) return [];
        const next = new Set(seen).add(id);
        let result: Spec[] = [];
        if (kind === 'noun' && noun && nounStems) {
            result = ((noun.cells as Cells)[slot] ?? []).flatMap(t => {
                if (t === NOM || t === ANIM) {
                    const n = slot.startsWith('sg') ? 'sg' : slot.startsWith('pl') ? 'pl' : 'du';
                    const target = t === ANIM && animate ? `${n}Gen` : n === 'du' ? 'duNomAcc' : `${n}Nom`;
                    return specs(kind, target, undefined, next);
                }
                return buildSpec(nounStems, t);
            });
        } else if (kind === 'verb' && verb && verbStems && !slot.startsWith('part')) {
            result = ((verb.cells as Cells)[slot] ?? []).flatMap(t => buildSpec(verbStems, t));
        } else if ((kind.startsWith('adjective-') && adjective && adjStems) || (kind.startsWith('participle-') && base && (noun || verb || adjective))) {
            const p = kind.startsWith('participle-') ? participleParadigm(base!) : adjective;
            if (!p) return [];
            const stems = kind.startsWith('participle-') ? p.stems(base!) : adjStems!;
            const full = kind.endsWith('-plen');
            result = (adjCells(p, stems, full)[slot] ?? []).flatMap(t =>
                t === PLEN ? specs(kind.replace(/-brev$/, '-plen'), slot, base, next) : buildSpec(stems, t));
        }
        memo.set(id, result);
        return result;
    }
    return (kind: string, slot: string, value: string, base?: string): EndingResult => {
        if (abbreviated(value)) return { segments: null, reason: 'abbreviated_or_superscript' };
        const candidates = specs(kind, slot, base);
        if (!candidates.length) return { segments: null, reason: 'unsupported_cell_or_scheme' };
        const points = cuts(value);
        const prefixes = new Map(points.map(at => [at, key(value.slice(0, at))]));
        const found = new Map<string, Segment[]>();
        for (const s of candidates) {
            const whole = key(s.stem + s.ending + tail);
            if (key(value) !== whole) continue;
            for (const at of points) {
                if (!at || prefixes.get(at) !== key(s.stem)) continue;
                for (const end of tail ? points.filter(p => p >= at) : [value.length]) {
                    if (key(value.slice(at, end)) !== key(s.ending) || key(value.slice(end)) !== key(tail)) continue;
                    const segments: Segment[] = [
                        { kind: 'stem', text: value.slice(0, at) },
                        { kind: 'ending', text: value.slice(at, end) },
                        ...(tail ? [{ kind: 'clitic' as const, text: value.slice(end) }] : []),
                    ];
                    found.set(`${at}:${end}`, segments);
                }
            }
        }
        if (found.size !== 1) return { segments: null, reason: found.size ? 'ambiguous_boundary' : 'surface_not_confirmed_by_cell' };
        return { segments: [...found.values()][0], reason: 'cell_template_confirmed' };
    };
}
