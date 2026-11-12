import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { utils, write } from "xlsx";
import { decodeImportText, importSheetNames, readImportSheet, defaultImportSelection, selectImportNames, MAX_IMPORT_ROWS } from "./tableImport";
import { parseImportedNames } from "./importRows";
const options = { encoding: "auto", separator: "auto" } as const;
const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const csv = (text: string, next = options) => readImportSheet(bytes(text), "names.csv", "Таблица", next);

// Эти книги — входные данные для теста самого импортёра, а не пользовательские артефакты.
const workbook = (bookType: "xlsx" | "biff8") => {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.aoa_to_sheet([["Не тот лист"], ["Мария"]]), "Первый");
    const sheet = utils.aoa_to_sheet([]);
    utils.sheet_add_aoa(sheet, [["№", "Имя", "Не импортировать"], [1, "Николай", "телефон"], [2, "Мария", "адрес"], [3, "", "прочее"], [4, "Николай", "примечание"]], { origin: "C5" });
    utils.book_append_sheet(book, sheet, "Помянник");
    return write(book, { type: "array", bookType }) as ArrayBuffer;
};

describe("импорт таблицы с именами", () => {
    for (const [name, type] of [["names.xlsx", "xlsx"], ["names.xls", "biff8"]] as const) {
        it(`читает ${name}, выбирает нужный лист и сохраняет исходные координаты`, () => {
            const data = workbook(type);
            assert.deepEqual(importSheetNames(data, name), ["Первый", "Помянник"]);
            const sheet = readImportSheet(data, name, "Помянник", options);
            assert.deepEqual(sheet.columns, ["C", "D", "E"]);
            assert.deepEqual(defaultImportSelection(sheet), { column: "D", start: 6, end: 9 });
            const result = selectImportNames(sheet, "D", 7, 9);
            assert.deepEqual(result.names, [{ name: "Мария", row: 7 }, { name: "Николай", row: 9 }]);
            assert.equal(result.blank, 1);
            assert.equal(result.names.some(p => p.name.includes("телефон")), false);
        });
    }
    it("разбирает CSV с точкой с запятой, кавычками и переносом внутри ячейки", () => {
        const sheet = csv('\ufeff№;Имя;Примечание\r\n1;"Мария";"текст; с разделителем"\r\n2;"Анна\nМария";другое\r\n3;"Иоанн, Пётр";заметка');
        assert.deepEqual(defaultImportSelection(sheet), { column: "B", start: 2, end: 4 });
        assert.equal(sheet.cells.B3, "Анна\nМария");
        assert.equal(sheet.cells.B4, "Иоанн, Пётр");
        assert.deepEqual(selectImportNames(sheet, "B", 2, 2).names.map(p => p.name), ["Мария"]);
        assert.throws(() => selectImportNames(sheet, "B", 2, 4), /одно имя/);
    });
    it("позволяет явно указать разделитель CSV, поддерживает TSV", () => {
        const sheet = readImportSheet(bytes('Имя,Метка\nНиколай,тест'), "names.csv", "Таблица", { ...options, separator: "," });
        assert.equal(sheet.cells.A2, "Николай");
        const tab = readImportSheet(bytes('Имя\tМетка\nМария\tтест'), "names.tsv", "Таблица", options);
        assert.equal(tab.cells.B2, "тест");
    });
    it("не делит строки TXT по запятым и пропускает пустые ячейки и числа", () => {
        const sheet = readImportSheet(bytes('Николай\r\n\r\n123\r\nИоанн, Пётр'), "names.txt", "Таблица", options);
        assert.equal(sheet.cells.A4, "Иоанн, Пётр");
        const selected = selectImportNames(sheet, "A", 1, 3);
        assert.deepEqual(selected.names, [{ name: "Николай", row: 1 }]);
        assert.equal(selected.blank, 1); assert.equal(selected.nonNames, 1);
    });
    it("читает кириллицу Windows-1251 и UTF-16 без подмены имён", () => {
        const cp = new Uint8Array([0xcc, 0xe0, 0xf0, 0xe8, 0xff]); // Мария
        assert.equal(decodeImportText(cp.buffer, "auto"), "Мария");
        assert.equal(decodeImportText(cp.buffer, "windows-1251"), "Мария");
        const utf16 = new Uint8Array([0xff, 0xfe, 0x1c, 0x04, 0x30, 0x04, 0x40, 0x04, 0x38, 0x04, 0x4f, 0x04]);
        assert.equal(decodeImportText(utf16.buffer, "auto"), "Мария");
    });
    it("сохраняет одинаковые имена, не обрезает выбор свыше лимита", () => {
        const sheet = csv(Array(501).fill("Николай").join('\n'));
        assert.equal(selectImportNames(sheet, "A", 1, 500).names.length, 500);
        assert.throws(() => selectImportNames(sheet, "A", 1, 501), /Выбрано 501/);
    });
    it("проверяет границы диапазона и длину имени", () => {
        const sheet = csv('Имя\nНиколай');
        for (const [col, start, end] of [["A", 0, 1], ["A", 2, 1], ["B", 1, 2], ["A", 1, 10001], ["A", 1.5, 2]] as const) assert.throws(() => selectImportNames(sheet, col, start, end));
        assert.throws(() => selectImportNames(csv('а'.repeat(61)), "A", 1, 1), /60/);
        assert.throws(() => importSheetNames(new ArrayBuffer(0), "names.csv"), /пуст/);
        assert.throws(() => importSheetNames(bytes('тест'), "names.html"), /Выберите/);
    });
    it("не предлагает импортировать единственную строку заголовка как имя", () => {
        const sheet = csv("Имя");
        assert.deepEqual(defaultImportSelection(sheet), { column: "A", start: 2, end: 1 });
    });
    it("показывает ограничение чтения длинного файла", () => {
        const sheet = readImportSheet(bytes(Array(MAX_IMPORT_ROWS + 1).fill('Иоанн').join('\n')), "names.txt", "Таблица", options);
        assert.equal(sheet.clipped, true); assert.equal(sheet.lastRow, MAX_IMPORT_ROWS);
    });
});

describe("приём выбранных имён на сервере", () => {
    it("берёт только имена, сохраняет номера строк, не интерпретирует запятую как метаданные", () => {
        const batch = parseImportedNames([{ row: 6, name: "Николай" }, { row: 9, name: "Пётр", userId: "foreign", relation: "чужое поле" }], "departed");
        assert.deepEqual(batch.lines.map(line => line.line), [6, 9]);
        assert.equal(batch.lines[1].person?.name, "Пётр");
        assert.throws(() => parseImportedNames([{ row: 1, name: "Иоанн, Пётр" }], "living"), /одно имя/);
        assert.equal(batch.lines[1].person?.kind, "departed");
        assert.equal(batch.lines[1].person?.relation, undefined);
        assert.equal("userId" in batch.lines[1].person!, false);
    });
    it("принимает все 500 выбранных имён без обрезания", () => {
        const names = Array.from({ length: 500 }, (_, i) => ({ row: i + 2, name: "Николай" }));
        const batch = parseImportedNames(names, "living");
        assert.equal(batch.count, 500);
        assert.equal(batch.lines[499].line, 501);
        assert.equal(batch.truncated, false);
    });
    it("отвергает повтор номера строки, неверные значения и превышение лимита", () => {
        for (const raw of [null, [], [{ row: 1, name: "123" }], [{ row: 1, name: 42 }], [{ row: 10001, name: "Мария" }], [{ row: 1, name: "Мария" }, { row: 1, name: "Пётр" }], Array.from({ length: 501 }, (_, i) => ({ row: i + 1, name: "Николай" }))]) assert.throws(() => parseImportedNames(raw, "living"));
    });
});
