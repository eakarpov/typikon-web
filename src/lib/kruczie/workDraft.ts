import type { Melody } from "@znamenica/kruczie";
import { partialWorkCells, exportWork, type WorkBlock, type WorkResult, type WorkCell, type WorkView, type WorkCandidate } from "./work";
export interface NoteFill { raw: string; origin: "manual" | "catalog"; melody: Melody }
export type WorkFills = Record<number, Record<number, NoteFill>>;
export interface SavedWorkDraft { version: 1; raw: string; fills: WorkFills }
export const WORK_DRAFT_KEY = "kruczie.work-draft.v1";
export async function createNoteFill(raw: string, origin: NoteFill["origin"]): Promise<NoteFill> {
    if (!raw.trim() || raw.length > 1000 || /[\r\n]/u.test(raw)) throw new Error("Введите измеренные ноты одной позиции, например с1м1 или п2.");
    const { getMeasuredNotes, parseMelody } = await import("@znamenica/kruczie/melody");
    const compact = raw.replace(/\s+/gu, "");
    const checked = getMeasuredNotes(compact);
    if (!checked.value?.length || checked.diagnostics.some(d => d.severity === "error")) throw new Error("Не удалось прочитать все ноты. Укажите высоту и измеренную длительность каждой ноты; речитация (...) требует явной длительности.");
    const melody = parseMelody(compact).value!;
    if (melody.events?.some(e => e.kind !== "note" && !(e.kind === "mark" && (e.mark === "bar" || e.mark === "end")))) throw new Error("В позиции допустимы только ноты с длительностями, без директив; допускаются завершающие черты / и обратная косая черта.");
    return { raw: compact, origin, melody };
}
export function resolvedWorkCells(row: WorkBlock, result: WorkResult | undefined, choices: Readonly<Record<number, number>>, fills: Readonly<Record<number, NoteFill>> = {}): WorkCell[] {
    return partialWorkCells(row, result, choices).map((cell, i) => fills[i] ? { ...cell, partial: false, fillOrigin: fills[i].origin, syllable: { ...cell.syllable, melody: fills[i].melody } } : cell);
}
export async function exportCompletedWork(view: WorkView, rows: readonly (readonly WorkCell[])[]): Promise<string> {
    if (rows.length !== view.blocks.length) throw new Error("Число блоков изменилось.");
    const candidates: Record<number, WorkCandidate> = {};
    for (const [index, cells] of rows.entries()) {
        if (!view.file.blocks[index].aligned || cells.length !== view.blocks[index].cells.length || !cells.length) throw new Error(`Блок ${index + 1}: сначала исправьте слоговую привязку.`);
        for (const [position, cell] of cells.entries()) {
            if (!cell.syllable.melody) throw new Error(`Блок ${index + 1}, позиция ${position + 1}: заполните пропуск или выберите развод.`);
            try { await createNoteFill(cell.syllable.melody.raw, cell.fillOrigin ?? "catalog"); }
            catch (cause) { throw new Error(`Блок ${index + 1}, позиция ${position + 1}: ${cause instanceof Error ? cause.message : String(cause)}`); }
        }
        candidates[index] = { syllables: cells.map(c => c.syllable), cells: [...cells], notes: cells.map(c => c.syllable.melody!.raw).join(" "), neumes: cells.map(c => c.syllable.notation?.raw ?? "").join(" "), origins: ["Разбор, сохранённый пользователем"], preferred: false };
    }
    return exportWork(view.file.raw, candidates);
}
export function encodeWorkDraft(draft: SavedWorkDraft): string {
    const fills = Object.fromEntries(Object.entries(draft.fills).map(([block, positions]) => [block, Object.fromEntries(Object.entries(positions).map(([position, fill]) => [position, { raw: fill.raw, origin: fill.origin }]))]));
    return JSON.stringify({ version: 1, raw: draft.raw, fills });
}
export async function decodeWorkDraft(text: string): Promise<SavedWorkDraft> {
    if (text.length > 2000000) throw new Error("Сохранённый разбор слишком большой.");
    const value = JSON.parse(text);
    const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
    const index = (key: string) => /^(0|[1-9][0-9]*)$/u.test(key) && Number.isSafeInteger(Number(key));
    if (!object(value) || value.version !== 1 || typeof value.raw !== "string" || !value.raw.trim() || value.raw.length > 200000 || !object(value.fills)) throw new Error("Формат сохранённого разбора не поддерживается.");
    const fills: WorkFills = {};
    for (const [block, positions] of Object.entries(value.fills)) {
        if (!index(block) || !object(positions)) throw new Error("Некорректный номер блока в сохранении.");
        fills[Number(block)] = {};
        for (const [position, fill] of Object.entries(positions)) {
            if (!index(position) || !object(fill) || typeof fill.raw !== "string" || (fill.origin !== "catalog" && fill.origin !== "manual")) throw new Error("Некорректная позиция в сохранении.");
            fills[Number(block)][Number(position)] = await createNoteFill(fill.raw, fill.origin);
        }
    }
    const { inspectWork } = await import("./work");
    const view = await inspectWork(value.raw);
    for (const [block, positions] of Object.entries(fills)) for (const position of Object.keys(positions)) {
        if (!view.blocks[Number(block)]?.cells[Number(position)]) throw new Error("Сохранённая позиция отсутствует в произведении.");
    }
    return { version: 1, raw: value.raw, fills };
}
export async function readWorkDraft(): Promise<SavedWorkDraft | null> {
    const text = localStorage.getItem(WORK_DRAFT_KEY);
    return text ? decodeWorkDraft(text) : null;
}
