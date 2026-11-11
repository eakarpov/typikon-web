import { conjugate } from '@/lib/morphology/decline';
import { PARTICIPLE_TITLES, participleStem } from './legacyView';
import { endingSegmenter } from './endingSegments';
import type { Article } from './types';

export function resegmentArticle(article: Article) {
    const row = { name: article.originalName, scheme: article.scheme, properties: article.properties.join(',') };
    const segment = endingSegmenter(row);
    const bases = new Map<string, string>();
    try {
        if (article.paradigms.some(p => p.kind.startsWith('participle-'))) {
            const table = conjugate(row);
            for (const [slot, title] of PARTICIPLE_TITLES) {
                const seed = table?.[slot]?.[0];
                if (seed) bases.set(title, participleStem(seed));
            }
        }
    } catch { /* No inferred base when the configured conjugation cannot be applied. */ }
    const counts: Record<string, number> = {};
    const examples: { kind: string; slot: string; value: string; before: unknown; after: unknown; reason: string }[] = [];
    const count = (key: string) => counts[key] = (counts[key] ?? 0) + 1;
    for (const p of article.paradigms) {
        const base = bases.get(p.title.replace(/ · (краткие|полные)$/, ''));
        for (const slot of p.slots) for (const form of slot.forms) {
            const old = form.segments;
            const result = segment(p.kind, slot.id, form.value, base);
            count('forms'); count('before:' + (old ? 'segmented' : 'null'));
            count('after:' + (result.segments ? 'segmented' : 'null'));
            count('kind:' + p.kind + ':' + result.reason);
            if (result.segments && result.segments.map(s => s.text).join('') !== form.value) throw Error('Surface changed');
            if (JSON.stringify(old) !== JSON.stringify(result.segments)) {
                count('changed');
                count(old ? result.segments ? 'corrected' : 'removedUnconfirmed' : 'added');
                if (examples.length < 12) examples.push({ kind: p.kind, slot: slot.id, value: form.value, before: old, after: result.segments, reason: result.reason });
                form.segments = result.segments;
            }
        }
    }
    return { counts, examples };
}
