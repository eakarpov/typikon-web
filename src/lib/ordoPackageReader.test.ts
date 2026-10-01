import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { parsePackage } from "@/lib/ordoPackageReader";

// Читатель пакета — то, чем сайт и браузер смотрят .ordo. Собираем пакет
// в памяти (zipSync) и проверяем сшивку: тела по месту, три разных молчания,
// заглушку престола, братьев по адресу, честные beda.

const pkg = (files: Record<string, string>): Uint8Array =>
    zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

const MINI = {
    "mimetype": "application/vnd.ordo+zip",
    "manifest.json": JSON.stringify({
        format: "posledovanie", spec_version: "1.0",
        scope: { date: "2026-09-26", service: "liturgy", ordo: "test-liturgy" },
        gates: "rights", license: "CC-BY-4.0",
        body_counts: { present: 1, "not-collected": 1, unset: 1 },
    }),
    "ordo.json": JSON.stringify({
        service: "liturgy",
        feast_label: "предпразднство",
        rules: [{ kind: "служба", label: "Литургия", path: "rules/ordo/services/liturgy.yaml" }],
        steps: [
            { kind: "text", label: "Молитва", text: "Святый Боже" },
            {
                kind: "position", label: "Стихиры",
                items: [
                    { address: "mineya-1", book_label: "Минея" },
                    { address: "mineya-2", missing: true, text: "(престол не выбран)" },
                    { address: "pustaya" },
                    { missing: true },
                ],
            },
        ],
    }),
    "addresses.json": JSON.stringify({
        spec: "1.0",
        lines: [
            { step: 1, item: 0, address: "mineya-1", edition: "menaion", language: "cu_gr",
              body: { in: "texts/menaion.jsonl", line: 0 } },
            { step: 1, item: 1, address: "mineya-2", body: { absent: "unset" } },
            { step: 1, item: 2, address: "pustaya", body: { absent: "not-collected" } },
        ],
        memories: {},
    }),
    "texts/menaion.jsonl":
        '{"address":"mineya-1","language":"cu_gr","text":"Блажен муж"}\n',
};

test("сшивка: тело по месту, молчания различны, заглушка бережётся", () => {
    const parsed = parsePackage(pkg(MINI));
    assert.equal(parsed.beda.length, 0);
    assert.equal(parsed.manifest?.scope?.service, "liturgy");
    assert.equal(parsed.ordo?.feast_label, "предпразднство");

    const [formula, position] = parsed.steps as any[];
    // формула канвы — при своём тексте, права её не касались
    assert.equal(formula.text, "Святый Боже");
    assert.equal(position.rules === undefined, true);

    const [withBody, placeholder, empty, unnamed] = position.items;
    assert.equal(withBody.text, "Блажен муж");
    assert.equal(withBody.edition, "menaion");
    assert.equal(withBody.language, "cu_gr");
    // заглушка «престол не выбран» — часть канвы: слово о молчании её не затирает
    assert.equal(placeholder.text, "(престол не выбран)");
    assert.equal(placeholder.absent, "unset");
    assert.equal(empty.text, "‹текста нет: не собран›");
    // строки вовсе нет в указателе — честное слово вместо отсутствия ключа
    assert.equal(unnamed.text, "‹текста нет: пакет о нём не говорит›");
});

test("битая ссылка на тело — beda, а не падение", () => {
    const broken = {
        ...MINI,
        "addresses.json": JSON.stringify({
            spec: "1.0",
            lines: [{ step: 1, item: 0, address: "mineya-1",
                      body: { in: "texts/menaion.jsonl", line: 5 } }],
        }),
    };
    const parsed = parsePackage(pkg(broken));
    assert.ok(parsed.beda.some(b => b.includes("строки 5 нет")));
});

test("архив без ordo.json — не пакет, честный отказ", () => {
    const parsed = parsePackage(pkg({ "README.txt": "просто файл" }));
    assert.equal(parsed.ordo, null);
    assert.ok(parsed.beda.some(b => b.includes("ordo.json")));
});

test("братья по адресу поднимаются к строке", () => {
    const withAlt = {
        ...MINI,
        "addresses.json": JSON.stringify({
            spec: "1.0",
            lines: [{
                step: 1, item: 0, address: "mineya-1",
                body: { in: "texts/menaion.jsonl", line: 0 },
                alternates: [
                    { language: "grc", edition: "greek-ages", basis: "address",
                      body: { in: "texts/greek-ages.jsonl", line: 0 } },
                    { language: "en", edition: null, basis: "address",
                      body: { absent: "not-collected" } },
                ],
            }],
        }),
        "texts/greek-ages.jsonl": '{"address":"mineya-1","language":"grc","text":"Μακάριος"}\n',
    };
    const parsed = parsePackage(pkg(withAlt));
    const item = (parsed.steps[1] as any).items[0];
    assert.equal(item.text, "Блажен муж");
    assert.equal(item.parallel.length, 2);
    assert.equal(item.parallel[0].text, "Μακάριος");
    assert.equal(item.parallel[1].absent, "not-collected");
});
