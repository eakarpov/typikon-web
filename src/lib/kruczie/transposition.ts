import type { Catalog, ChantTradition, Tone, Melody, Pitch } from "@znamenica/kruczie";
import type { MusicLayers } from "./znamen";

export interface NotationShift { semitones: number; tradition: ChantTradition; tone?: Tone }
/** Staff rendering has no ZF octave restriction. Serialization is checked separately. */
export function shiftedMelody(melody: Melody, semitones: number): Melody {
    if (!Number.isSafeInteger(semitones)) throw new Error("Перенос должен быть целым числом полутонов.");
    if (!semitones) return melody;
    const offsets = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const steps: Pitch["step"][] = ["C", "C", "D", "E", "E", "F", "F", "G", "A", "A", "B", "B"];
    const alterations: Pitch["alteration"][] = [0,1,0,-1,0,0,1,0,-1,0,-1,0];
    return { ...melody, events: melody.events?.map(event => {
        if (event.kind !== "note" && event.kind !== "reciting") return event;
        const midi = (event.pitch.octave + 1) * 12 + offsets[event.pitch.step] + event.pitch.alteration + semitones;
        const pc = ((midi % 12) + 12) % 12;
        return { ...event, pitch: { step: steps[pc], octave: Math.floor(midi / 12) - 1, alteration: alterations[pc] } };
    }) };
}
let builtin: Catalog | undefined;
interface Pair { neumes: string; notes: string }
interface PairIndex { source: Map<string, Pair[]>; target: Map<string, Set<string>> }
const indexes = new WeakMap<Catalog, Map<string, PairIndex>>();
// Only height prefixes are ignored when comparing the shapes of known records.
// Register priznaki, cues and all other modifiers must remain exact.
const shape = (raw: string) => raw.replace(/(^|\s|~~)(?:\*?[ГНцгнсмпвМПВ](?:[#@])?)+/gu, "$1");
export async function transposeLayers(layers: MusicLayers, options: NotationShift, supplied?: Catalog): Promise<MusicLayers> {
    if (!Number.isSafeInteger(options.semitones)) throw new Error("INVALID_TRANSPOSITION: перенос должен быть целым числом полутонов.");
    if (!options.semitones) return { ...layers };
    const [{ transposeMelody, melodyKey, parseMelody }, { normalizeNeumes, parseNeumeGroup }, { createBuiltinCatalog }] = await Promise.all([import("@znamenica/kruczie/melody"), import("@znamenica/kruczie"), import("@znamenica/kruczie/data")]);
    const catalog = supplied ?? (builtin ??= createBuiltinCatalog());
    const context = JSON.stringify([options.tradition, options.tone]);
    let index = indexes.get(catalog)?.get(context);
    if (!index) {
    const records: Pair[] = [];
    const add = (neumes?: string, notes?: string) => { if (neumes && notes) records.push({ neumes, notes }); };
    for (const symbol of catalog.symbols) if (symbol.tradition === options.tradition) add(symbol.zf, symbol.notes);
    for (const formula of catalog.dataset.formulas) {
        if (formula.tradition !== options.tradition || (options.tone !== undefined && !formula.tones.includes(options.tone))) continue;
        if (!formula.valueNotes || formula.value.length !== formula.valueNotes.length) continue;
        add(formula.value.join(" "), formula.valueNotes.join(" "));
        formula.value.forEach((neumes, i) => add(neumes, formula.valueNotes![i]));
    }
    index = { source: new Map(), target: new Map() };
    for (const record of records) {
        const normalized = normalizeNeumes(record.neumes), key = melodyKey(record.notes);
        if (!key) continue;
        const existing = index.source.get(normalized) ?? [];
        existing.push(record); index.source.set(normalized, existing);
        const targetKey = shape(normalized) + "\0" + key;
        const targets = index.target.get(targetKey) ?? new Set<string>();
        targets.add(normalized); index.target.set(targetKey, targets);
    }
    const contexts = indexes.get(catalog) ?? new Map<string, PairIndex>();
    contexts.set(context, index); indexes.set(catalog, contexts);
    }
    const norm = normalizeNeumes;
    const shifted = (notes: string) => {
        const result = transposeMelody(notes, options.semitones);
        if (!result.value) throw new Error(`UNREPRESENTABLE_TRANSPOSITION: выбранная высота не может быть записана в поддерживаемом формате znamen.ru. ${result.diagnostics.map(d => d.code).join(", ")}`);
        const original = parseMelody(notes).value!;
        const targets = result.value.events!;
        let cursor = 0, raw = "";
        original.events!.forEach((event, i) => {
            if (event.kind !== "note" && event.kind !== "reciting") return;
            if (!event.range) throw new Error("Отсутствует позиция ноты в исходнике.");
            raw += notes.slice(cursor, event.range.start) + targets[i].raw;
            cursor = event.range.end;
        });
        return raw + notes.slice(cursor);
    };
    if (layers.notation === undefined) return { ...layers, ...(layers.melody === undefined ? {} : { melody: shifted(layers.melody) }) };
    const one = (notation: string, notes?: string): MusicLayers => {
        const parsed = notation.split(/\s+|~~/u).map(group => parseNeumeGroup(group));
        if (parsed.some(p => !p.value?.recognized || p.value.cues.length || p.value.priznaki.length)) throw new Error("UNCONFIRMED_POMETA_SHIFT: перенос неизвестных знаков, признáков или подсказок в скобках не подтверждён. Исходник сохранён.");
        const source = (index!.source.get(norm(notation)) ?? []);
        if (!notes) {
            const variants = [...new Map(source.map(r => [melodyKey(r.notes), r.notes])).values()];
            if (variants.length !== 1) throw new Error("AMBIGUOUS_POMETA_SHIFT: без однозначного нотного развода перенос помет не определён.");
            notes = variants[0];
        }
        const targetNotes = shifted(notes);
        if (!source.some(record => melodyKey(record.notes) === melodyKey(notes!))) throw new Error("UNCONFIRMED_SOURCE_PAIR: соответствие исходных нот и крюков не подтверждено коллекцией; перенос помет отклонён.");
        const candidates = [...(index!.target.get(shape(norm(notation)) + "\0" + melodyKey(targetNotes)) ?? [])].sort();
        if (candidates.length !== 1) throw new Error("UNCONFIRMED_POMETA_SHIFT: для выбранной высоты нет однозначного подтверждённого варианта тех же крюков с новыми пометами.");
        return { notation: candidates[0], ...(layers.melody === undefined ? {} : { melody: targetNotes }) };
    };
    // Preserve the original whitespace and positional boundaries, including empty positions.
    const groups = layers.notation.split(/(\s+)/u), notes = layers.melody?.trim().split(/\s+/u);
    const count = groups.filter((_, i) => i % 2 === 0).length;
    if (notes && notes.length !== count) return one(layers.notation, layers.melody);
    const movedNotes: string[] = [];
    const notation = groups.map((group, i) => {
        if (i % 2) return group;
        const result = one(group, notes?.[i / 2]);
        if (result.melody !== undefined) movedNotes.push(result.melody.replace(/\s+/gu, ""));
        return result.notation!;
    }).join("");
    return { notation, ...(layers.melody === undefined ? {} : { melody: layers.melody.split(/(\s+)/u).map((part, i) => i % 2 ? part : movedNotes[i / 2]).join("") }) };
}

/** All musical blocks move atomically; source text and unrelated ranges are retained. */
export async function transposeZnamen(raw: string, options: NotationShift): Promise<string> {
    if (!options.semitones) return raw;
    const { parseZnamen } = await import("@znamenica/kruczie/formats/znamen");
    const file = parseZnamen(raw);
    if (!file.value || file.diagnostics.some(d => d.severity === "error" && !(d.code === "LAYER_ALIGNMENT" && file.value!.blocks.some(block => block.text === undefined && block.range.start === d.range?.start)))) throw new Error("INVALID_TRANSPOSE_DOCUMENT: исправьте диагностику исходника перед переносом.");
    const edits: { start: number; end: number; value: string }[] = [];
    for (const [blockIndex, block] of file.value.blocks.entries()) {
        let layers: MusicLayers;
        try { layers = await transposeLayers({ ...(block.notation === undefined ? {} : { notation: block.notation }), ...(block.melody === undefined ? {} : { melody: block.melody }) }, options); }
        catch (cause) { throw new Error(`Блок ${blockIndex + 1}: ${cause instanceof Error ? cause.message : String(cause)}`); }
        for (const lineIndex of block.lineIndexes) {
            const line = file.value.lines[lineIndex];
            const value = line.name === "з" ? layers.notation : line.name === "н" ? layers.melody : undefined;
            if (value !== undefined && line.payloadRange) edits.push({ ...line.payloadRange, value });
        }
    }
    // Commit only after every block succeeds. Never rewrite headers, text or footer.
    let output = raw;
    for (const edit of edits.sort((a,b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
    return output;
}
