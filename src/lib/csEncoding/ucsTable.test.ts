import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { UCS_BYTES, UCS_DISPUTED, UCS_UNDEFINED } from "@/lib/csEncoding/ucsTable";

test("в раскладке ровно 256 мест", () => {
    // Массив, а не словарь по знакам, ради одного этого утверждения: место в
    // раскладке нельзя потерять молча, его можно только объявить пустым.
    assert.equal(UCS_BYTES.length, 256);
    for (let b = 0; b < 256; b++) {
        assert.equal(typeof UCS_BYTES[b], "string", `место 0x${b.toString(16)} пустует`);
    }
});

test("записи устойчивы к NFC", () => {
    // Иначе одно и то же слово ляжет в собрание двумя строками и перестанет
    // находиться — та же ловушка, на которой поиск однажды потерял 59 638 строк.
    for (let b = 0; b < 256; b++) {
        if (b === UCS_UNDEFINED) continue;
        assert.equal(UCS_BYTES[b], UCS_BYTES[b].normalize("NFC"),
            `0x${b.toString(16)}: запись меняется при NFC`);
    }
});

test("спорные места записаны обоими чтениями", () => {
    for (const [key, dispute] of Object.entries(UCS_DISPUTED)) {
        const byte = Number(key);
        assert.equal(UCS_BYTES[byte], dispute.ours,
            `0x${byte.toString(16)}: в таблице стоит не то чтение, что объявлено нашим`);
        assert.notEqual(dispute.ours, dispute.other, "спора нет: чтения совпадают");
        assert.ok(dispute.why.length > 0, "спор без объяснения");
    }
});

test("таблица не меняется незаметно", () => {
    // Слепок вместо второй таблицы. Сверка с независимым выводом раскладки
    // (cslavonic, MIT) прогнана при составлении и записана числами в заголовке
    // ucsTable.ts; вкладывать сюда чужую таблицу мы не стали — она сама
    // транскрипция Perl-Lingua-CU, чьи условия не проверены.
    //
    // Слепок ловит другое: случайную правку. Правка осмысленная переписывает
    // и слепок — но уже руками, то есть заметив, что именно меняет.
    const hash = createHash("sha256").update(UCS_BYTES.join(" ")).digest("hex");
    assert.equal(hash, "5b82a8fab0bc42deeae5031982a659c41d0225a77ba14a0cf38fb943625b7bd2");
});
