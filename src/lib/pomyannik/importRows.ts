import { normalizeName, stripAccents } from "@/lib/imeniny/core";
import { guessSex } from "./names";
import { MAX_BATCH, type PersonKind } from "./types";
import type { ParsedBatch, ParsedLine } from "./parse";
export interface ImportedName { name: string; row: number }
export class NameImportError extends Error {}
export const normalizedImportedName = (raw: string, row: number): string => {
    const value = raw.replace(/\s+/g, " ").trim();
    const name = normalizeName(value);
    if (!name || name.length > 60 || name.toLocaleLowerCase("ru") !== stripAccents(value).toLocaleLowerCase("ru")) {
        throw new NameImportError(`Строка ${row}: в ячейке должно быть одно имя кириллицей, без фамилии и помет, не длиннее 60 знаков.`);
    }
    return name;
};
/** В табличном импорте берём только выбранную ячейку, без разбора соседних данных и помет. */
export const parseImportedNames = (raw: unknown, kind: PersonKind): ParsedBatch => {
    if (!Array.isArray(raw) || !raw.length || raw.length > MAX_BATCH) throw new NameImportError(`Выберите от 1 до ${MAX_BATCH} имён.`);
    const seen = new Set<number>();
    const lines: ParsedLine[] = raw.map(entry => {
        if (!entry || typeof entry.name !== "string" || entry.name.length > 120 || !Number.isInteger(entry.row) || entry.row < 1 || entry.row > 10000 || seen.has(entry.row)) throw new NameImportError("Некорректная строка таблицы.");
        seen.add(entry.row);
        const name = normalizedImportedName(entry.name, entry.row);
        return { line: entry.row, raw: entry.name, person: { name, kind, sex: guessSex(name) }, unparsed: [] };
    });
    return { lines, count: lines.length, truncated: false };
};
