import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { PUA_BY_CODE, PUA_TABLE, PUA_PATTERN } from '@/lib/csEncoding/pua';
import { normalizeChurchSlavonic } from '@/utils/churchSlavonic';
import { fail, revision, sha, canonical, utf16, LIMITS, type Obj } from './core';

const glyphs: Record<string, string> = { 'ᲀ': 'в', 'ᲁ': 'д', 'ᲂ': 'о', 'ᲃ': 'с', 'ᲄ': 'т', 'ᲅ': 'т', 'ᲆ': 'ъ', 'ᲇ': 'ѣ', 'ᲈ': 'ꙋ' };
export const profileSets = ['source', 'unicode', 'letterfold'].map(name => ({ id: 'cs-pilot-' + name + '-r1', profiles: { markup: 'markup-r1', display: name === 'source' ? 'display-source-r1' : name === 'unicode' ? 'display-unicode-r1' : 'display-letterfold-r1', tokenizer: 'token-cs-r1', lookup: 'lookup-cs-r1', search: 'search-cs-r1' }, versions: { unicode: process.versions.unicode, segmenter: 'cs-grapheme-r1/unicode' + process.versions.unicode, puaTableSha256: sha(canonical(PUA_TABLE)), letterTableSha256: sha(canonical(Object.entries(glyphs))) } }));
export function profile(id: string) { return profileSets.find(x => x.id === id) ?? fail('unsupported_profile', 422, 'Профиль не поддерживается.', { supported: profileSets.map(x => x.id) }); }
export function foldKnown(text: string, letters: boolean) { return text.replace(PUA_PATTERN, ch => { const e = PUA_BY_CODE[ch.codePointAt(0)!]; return e?.to && (letters || e.kind !== 'letter') ? e.to : ch; }); }
export function unknownGlyph(text: string) { return [...text].some(ch => { const n = ch.codePointAt(0)!; return /\p{Co}/u.test(ch) && !PUA_BY_CODE[n]?.to; }); }
export function lookupKey(text: string): string | null {
    if (unknownGlyph(text) || text.includes('\u200d')) return null;
    return foldKnown(text, true).normalize('NFD').toLowerCase().replace(/и\u0306/g, 'й').replace(/і\u0308/g, 'ї').replace(/[\u0300\u0301\u0311\u0486]/g, '').replace(/ᲂу/g, 'ꙋ').replace(/[ᲀ-ᲈ]/g, ch => glyphs[ch] ?? ch).normalize('NFC');
}
export function searchKey(text: string): string | null {
    const narrow = lookupKey(text); if (narrow === null) return null;
    return narrow.split(/(й)/).map(x => x === 'й' ? x : normalizeChurchSlavonic(x).replace(/[\p{M}\u200d]/gu, '')).join('');
}
type Atom = { start: number; end: number; text: string; rule: string; fidelity: string; styles: string[]; type: string; target?: Obj };
const segmenter = new Intl.Segmenter('cu', { granularity: 'grapheme' });
function atomsOf(raw: string, chant: boolean): Atom[] {
    const atoms: Atom[] = []; const tree: any = unified().use(remarkParse).parse(raw);
    function text(value: string, start: number, end: number, styles: string[] = [], type = 'text', target?: Obj) {
        const original = raw.slice(start, end);
        if (original.replace(/[ \t]+(?=\r?\n|$)/g, "").replace(/\r\n?/g, "\n") === value.replace(/[ \t]+(?=\r?\n|$)/g, "")) value = original;
        if (value !== original) { atoms.push({ start, end, text: value, rule: 'markup:decoded', fidelity: 'folded', styles, type, target }); return; }
        const marks = /\{(?:st|pl)\|([^}|]+)(?:\|([^}]*))?\}|\{k\|([^}]+)\}|\{(\d+)\}/g; let at = 0;
        function plain(a: number, b: number) { for (const part of segmenter.segment(value.slice(a, b))) { const pos = start + a + part.index; const previous = atoms[atoms.length - 1]; const ch = part.segment; const entry = PUA_BY_CODE[ch.codePointAt(0)!]; if (entry && (entry.kind === 'mark' || entry.kind === 'superscript') && previous && previous.end === pos) { previous.end = pos + ch.length; previous.text += ch; } else atoms.push({ start: pos, end: pos + ch.length, text: chant && ch === '/' ? '\n' : ch, rule: chant && ch === '/' ? 'chant:linebreak' : 'copy', fidelity: 'preserved', styles, type, target }); } }
        for (const m of value.matchAll(marks)) {            
plain(at, m.index!); const fullStart = start + m.index!, fullEnd = fullStart + m[0].length;
            if (m[4]) atoms.push({ start: fullStart, end: fullEnd, text: '[' + m[4] + ']', rule: 'markup:footnote', fidelity: 'generated', styles, type: 'footnote_ref', target: { number: Number(m[4]) } });
            else { const label = m[3] ?? m[2] ?? m[1]; const local = m[0].lastIndexOf(label); text(label, fullStart + local, fullStart + local + label.length, m[3] ? [...styles, 'red'] : styles, m[3] ? 'text' : 'link', m[3] ? undefined : { kind: m[0].startsWith('{st') ? 'saint' : 'place', id: m[1] }); }
            at = m.index! + m[0].length;
        } plain(at, value.length);
    }
    function walk(node: any, styles: string[] = [], target?: Obj) {
        const start = node.position?.start.offset, end = node.position?.end.offset;
        if (node.type === 'text') text(node.value, start, end, styles, target ? 'link' : 'text', target);
        else if (node.type === 'html') fail('projection_unavailable', 503, 'HTML-разметка требует отдельного адаптера.');
        else if (node.type === 'inlineCode') { const content = raw.slice(start, end); const offset = content.indexOf(node.value); text(node.value, start + offset, start + offset + node.value.length, [...styles, 'code']); }
        else if (node.type === 'break') atoms.push({ start, end, text: '\n', rule: 'markup:break', fidelity: 'folded', styles, type: 'linebreak' });
        else if (node.children) { const next = node.type === 'strong' ? [...styles, 'strong'] : node.type === 'emphasis' ? [...styles, 'em'] : node.type === 'heading' ? [...styles, 'heading'] : styles; const link = node.type === 'link' && /^(https?:\/\/|\/)/.test(node.url) ? { url: node.url } : target; for (const child of node.children) walk(child, next, link); }
        else if (node.value) text(String(node.value), start, end, styles);
    }
    walk(tree); atoms.sort((a, b) => a.start - b.start);
    const result: Atom[] = []; let at = 0;
    for (const atom of atoms) { if (atom.start < at) fail('projection_unavailable', 503, 'Перекрывающиеся исходные узлы.'); if (atom.start > at) { const gap = raw.slice(at, atom.start); result.push({ start: at, end: atom.start, text: /^\s+$/.test(gap) ? gap : '', rule: /^\s+$/.test(gap) ? 'copy' : 'markup:hidden', fidelity: 'preserved', styles: [], type: 'text' }); } result.push(atom); at = atom.end; }
    if (at < raw.length) result.push({ start: at, end: raw.length, text: '', rule: 'markup:hidden', fidelity: 'preserved', styles: [], type: 'text' });
    return result;
}
function merge(ranges: number[][]) { const out: number[][] = []; for (const r of ranges) { const last = out[out.length - 1]; if (last && last[1] === r[0]) last[1] = r[1]; else out.push([...r]); } return out; }
export function project(body: Obj, setId: string, window?: number[]): Obj {
    const ps = profile(setId), raw = utf16(body.raw), br = 'br1_' + sha(raw); if (br !== body.bodyRevision) fail('map_revision_mismatch', 409, 'Изменилась версия тела.');
    const atoms = atomsOf(raw, body.chant); let full = ''; const entries = atoms.map(atom => { const before = atom.text; const after = ps.profiles.display === 'display-source-r1' ? before : foldKnown(before, ps.profiles.display === 'display-letterfold-r1').normalize('NFC'); const outStart = full.length; full += after; return { ...atom, before, text: after, outStart, outEnd: full.length }; });
    const allTokens: Obj[] = []; const words = /[\p{L}\p{M}\p{Co}\u200d]+(?:[-’'][\p{L}\p{M}\p{Co}\u200d]+)*|\p{N}+|\r\n|\n|[^\S\r\n]+|./gu;
    let entryStart = 0;
    for (const m of full.matchAll(words)) {        
const a = m.index!, b = a + m[0].length; while (entryStart < entries.length && entries[entryStart].outEnd <= a) entryStart++; const parts = []; for (let j = entryStart; j < entries.length && entries[j].outStart < b; j++) { if (entries[j].outEnd > a) parts.push(entries[j]); } const rawRanges = merge(parts.map(x => [x.start, x.end])); if (!rawRanges.length) continue;
        const surface = rawRanges.map(r => raw.slice(r[0], r[1])).join(''); const abbreviated = /[\u0483\u0487\u2de0-\u2dff\u033e]/u.test(foldKnown(surface, true)); const letter = /\p{L}/u.test(m[0]); const type = /^\r?\n$/.test(m[0]) ? 'linebreak' : /^\s+$/.test(m[0]) ? 'space' : /^\p{N}+$/u.test(m[0]) ? 'numberCandidate' : letter ? (abbreviated && [...m[0]].filter(ch => /\p{L}/u.test(ch)).length === 1 ? 'numberCandidate' : 'word') : /[\p{Co}\p{M}]/u.test(m[0]) ? 'unresolved' : 'punctuation';
        const key = type === 'word' ? lookupKey(surface) : null; const broad = type === 'word' ? searchKey(surface) : null; const flags = [...(abbreviated ? ['abbreviated'] : []), ...(unknownGlyph(surface) ? ['unresolved_glyph'] : []), ...(parts.some(p => p.rule === 'markup:decoded') ? ['coarse_mapping'] : [])]; const blocked = type === 'word' && (key === null || flags.includes('coarse_mapping')) ? 'unresolved_glyph' : null;
        const identity = { bodyId: body.bodyId, bodyRevision: br, tokenizerProfileId: ps.profiles.tokenizer, type, rawRanges }; allTokens.push({ ...identity, tokenId: revision('tok1', identity), surfaceRanges: [[a, b]], flags, lookupKey: key !== null && !blocked ? { profileId: ps.profiles.lookup, value: key } : null, searchKeys: broad !== null && !blocked ? [{ profileId: ps.profiles.search, value: broad, matchKind: abbreviated ? 'abbreviation_skeleton' : 'folded' }] : [], blockedReason: blocked });
    }
    const [start, end] = window ?? [0, raw.length];
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > raw.length) fail('invalid_boundary', 400, 'Неверное окно.');
    const crosses = (a: number, b: number) => a < start && start < b || a < end && end < b;
    if (entries.some(x => crosses(x.start, x.end)) || allTokens.some(t => ['word', 'numberCandidate', 'unresolved'].includes(t.type) && crosses(t.rawRanges[0][0], t.rawRanges[t.rawRanges.length - 1][1]))) fail('invalid_boundary', 400, 'Граница разрезает слово или знаковый комплекс.');
    if (end - start > LIMITS.maxRawWindowUtf16) fail('response_too_large', 413, 'Нужно меньшее окно.');
    const selected = entries.filter(x => x.start >= start && x.end <= end); let viewText = ''; const segments: Obj[] = [], runs: Obj[] = [];
    for (const atom of selected) {        
const outStart = viewText.length; viewText += atom.text; const operation = atom.text === '' ? 'delete' : atom.text === raw.slice(atom.start, atom.end) ? 'copy' : 'replace'; const current = { rawRanges: [[atom.start, atom.end]], outRange: [outStart, viewText.length], operation, ruleId: operation === 'copy' ? 'copy' : atom.rule === 'copy' ? 'unicode:fold' : atom.rule, fidelity: unknownGlyph(atom.before) ? 'unresolved' : operation === 'copy' ? 'preserved' : 'folded' };
        const previous = segments[segments.length - 1]; if (previous && previous.operation === 'copy' && current.operation === 'copy' && previous.fidelity === current.fidelity && previous.rawRanges[0][1] === atom.start) { previous.rawRanges[0][1] = atom.end; previous.outRange[1] = viewText.length; } else segments.push(current);
        if (atom.text) { const run = { type: atom.text === '\n' ? 'linebreak' : atom.type, viewRange: [outStart, viewText.length], styles: atom.styles, ...(atom.target ? { target: atom.target } : {}) }; const prev = runs[runs.length - 1]; if (prev && prev.type === run.type && canonical(prev.styles) === canonical(run.styles) && canonical(prev.target ?? null) === canonical(run.target ?? null)) prev.viewRange[1] = viewText.length; else runs.push(run); }
    }
    const firstOut = selected[0]?.outStart ?? 0; const tokens = allTokens.filter(t => t.rawRanges.every((r: number[]) => r[0] >= start && r[1] <= end)).map(t => ({ ...t, surfaceRanges: t.surfaceRanges.map((r: number[]) => [r[0] - firstOut, r[1] - firstOut]) }));
    const base = { bodyId: body.bodyId, bodyRevision: br, rawWindow: [start, end], profileSetId: setId, segments }; const mapId = revision('map1', base); return { projectionId: revision('proj1', { bodyId: body.bodyId, bodyRevision: br, rawWindow: [start, end], profileSetId: setId, mapId }), bodyId: body.bodyId, bodyRevision: br, profileSetId: setId, bodyLengthUtf16: raw.length, rawWindow: [start, end], rawText: raw.slice(start, end), viewText, map: { ...base, mapId, inputProfileId: 'raw-r1', outputProfileId: ps.profiles.display, outputLengthUtf16: viewText.length }, tokens, runs };
}
