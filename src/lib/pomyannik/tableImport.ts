import { read, utils, type WorkBook, type WorkSheet } from "xlsx";
import { MAX_BATCH } from "./types";
import { normalizedImportedName, type ImportedName } from "./importRows";
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10000;
export type ImportEncoding = "auto" | "utf-8" | "windows-1251";
export type ImportSeparator = "auto" | ";" | "," | "\t";
export interface TableOptions { encoding: ImportEncoding; separator: ImportSeparator }
export interface ImportSheet {
    name: string;
    columns: string[];
    firstRow: number;
    lastRow: number;
    cells: Record<string, string>;
    clipped: boolean;
}
export const isTextImport = (filename: string) => /\.(csv|tsv|txt)$/i.test(filename);
const extension = (filename: string) => filename.split(".").pop()?.toLowerCase();
export const decodeImportText = (bytes: ArrayBuffer, encoding: ImportEncoding): string => {
    if (encoding !== "auto") return new TextDecoder(encoding, { fatal: true }).decode(bytes);
    const prefix = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
    if (prefix[0] === 0xff && prefix[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
    if (prefix[0] === 0xfe && prefix[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { return new TextDecoder("windows-1251").decode(bytes); }
};
const validateFile = (bytes: ArrayBuffer, filename: string) => {
    if (!bytes.byteLength) throw new Error("Файл пуст.");
    if (bytes.byteLength > MAX_IMPORT_FILE_BYTES) throw new Error("Файл больше 5 МБ.");
    if (!/\.(xlsx|xls|csv|tsv|txt)$/i.test(filename)) throw new Error("Выберите файл XLSX, XLS, CSV, TSV или TXT.");
};
export const importSheetNames = (bytes: ArrayBuffer, filename: string): string[] => {
    validateFile(bytes, filename);
    if (isTextImport(filename)) return ["Таблица"];
    const book = read(bytes, { type: "array", bookSheets: true });
    if (!book.SheetNames.length) throw new Error("В файле нет листов.");
    return book.SheetNames;
};
export const readImportSheet = (bytes: ArrayBuffer, filename: string, sheetName: string, options: TableOptions): ImportSheet => {
    validateFile(bytes, filename);
    if (extension(filename) === "txt") {
        const rows = decodeImportText(bytes, options.encoding).split(/\r\n|\r|\n/);
        const cells: Record<string, string> = {};
        rows.slice(0, MAX_IMPORT_ROWS).forEach((text, i) => { if (text.trim()) cells[`A${i + 1}`] = text; });
        return sheetFromCells("Таблица", cells, rows.length > MAX_IMPORT_ROWS);
    }
    const plain = isTextImport(filename);
    const book: WorkBook = read(plain ? decodeImportText(bytes, options.encoding) : bytes, {
        type: plain ? "string" : "array", raw: true, sheetRows: MAX_IMPORT_ROWS,
        sheets: plain ? undefined : sheetName, cellHTML: false, cellFormula: false, bookVBA: false,
        FS: extension(filename) === "tsv" ? "\t" : options.separator === "auto" ? undefined : options.separator,
    });
    const sheet: WorkSheet | undefined = book.Sheets[plain ? book.SheetNames[0] : sheetName];
    if (!sheet) throw new Error("Выбранный лист не найден.");
    const cells: Record<string, string> = {};
    for (const address of Object.keys(sheet)) {
        if (!/^[A-Z]+\d+$/.test(address)) continue;
        const cell = sheet[address];
        if (cell && cell.v != null) cells[address] = String(cell.w ?? cell.v);
    }
    const fullRef = sheet["!fullref"] ?? sheet["!ref"];
    const clipped = Boolean(fullRef && utils.decode_range(fullRef).e.r >= MAX_IMPORT_ROWS);
    return sheetFromCells(sheetName, cells, clipped);
};
const sheetFromCells = (name: string, cells: Record<string, string>, clipped: boolean): ImportSheet => {
    const columns = new Set<string>();
    let firstRow = MAX_IMPORT_ROWS, lastRow = 0;
    for (const [address, text] of Object.entries(cells)) {
        if (!text.trim()) continue;
        const match = /^([A-Z]+)(\d+)$/.exec(address)!;
        const row = Number(match[2]);
        if (row > MAX_IMPORT_ROWS) continue;
        columns.add(match[1]); firstRow = Math.min(firstRow, row); lastRow = Math.max(lastRow, row);
    }
    return { name, cells, columns: [...columns].sort((a,b) => utils.decode_col(a)-utils.decode_col(b)), firstRow: lastRow ? firstRow : 1, lastRow: lastRow || 1, clipped };
};
export const defaultImportSelection = (sheet: ImportSheet) => {
    const headers = /^(имя|имена|фио|ф\.и\.о\.?|name|names)$/i;
    const column = sheet.columns.find(col => headers.test((sheet.cells[`${col}${sheet.firstRow}`] ?? "").trim())) ?? sheet.columns[0] ?? "A";
    const header = headers.test((sheet.cells[`${column}${sheet.firstRow}`] ?? "").trim());
    return { column, start: sheet.firstRow + (header ? 1 : 0), end: sheet.lastRow };
};
export const selectImportNames = (sheet: ImportSheet, column: string, start: number, end: number) => {
    if (!sheet.columns.includes(column) || !Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > MAX_IMPORT_ROWS) throw new Error("Проверьте столбец и номера строк: начало должно быть не больше конца.");
    const names: ImportedName[] = [];
    let blank = 0, nonNames = 0;
    for (let row = start; row <= end; row++) {
        const name = (sheet.cells[`${column}${row}`] ?? "").replace(/\s+/g, " ").trim();
        if (!name) { blank++; continue; }
        if (!/\p{L}/u.test(name)) { nonNames++; continue; }
        if (name.length > 60) throw new Error(`Ячейка ${column}${row}: больше 60 знаков. Выберите столбец с именами.`);
        try { normalizedImportedName(name, row); }
        catch { throw new Error(`Ячейка ${column}${row}: укажите одно имя кириллицей без фамилии и помет. Для строк с пометами используйте вставку текста.`); }
        names.push({ name, row });
    }
    if (!names.length) throw new Error("В выбранном диапазоне нет имён.");
    if (names.length > MAX_BATCH) throw new Error(`Выбрано ${names.length} имён. За один раз можно записать ${MAX_BATCH}; уменьшите диапазон строк.`);
    return { names, blank, nonNames };
};
