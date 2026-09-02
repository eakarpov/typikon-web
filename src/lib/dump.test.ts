import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { formatBuiltAt, formatBytes, formatCount } from "./dump";

// Числа и дата выгрузки стоят на странице, которую читают снаружи: по ней
// решают, брать корпус или нет.

describe("дата сборки выгрузки", () => {
    it("пишет год словом, чтобы точка не удваивалась во фразе", () => {
        assert.equal(formatBuiltAt("2026-09-02"), "2 сентября 2026 года");
    });

    it("отдаёт как есть то, что датой не разбирается", () => {
        assert.equal(formatBuiltAt("не дата"), "не дата");
    });
});

describe("размеры и счёт в выгрузке", () => {
    it("считает килобайтами до мегабайта и мегабайтами дальше", () => {
        assert.equal(formatBytes(2048), "2 КБ");
        assert.equal(formatBytes(1048576 * 6.8), "6,8 МБ");
    });

    it("разделяет разряды", () => {
        assert.equal(formatCount(155765).replace(/ /g, " "), "155 765");
    });
});
