import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { parsePackage, scriptureRefs } from "@/lib/ordoPackageReader";

// Читатель пакета — то, чем сайт и браузер смотрят .ordo. Собираем пакеты
// в памяти (zipSync) и проверяем: формат 1.1 (день, services/<ключ>.json) и
// прежнюю одиночную форму (старые скачанные файлы должны открываться).
// Сшивка тел по месту, три разных молчания, заглушка престола, братья,
// честные beda, сбор адресов Писания.

const pkg = (files: Record<string, string>): Uint8Array =>
    zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

const LEGACY = {
    "mimetype": "application/vnd.ordo+zip",
    "manifest.json": JSON.stringify({
        format: "posledovanie", spec_version: "1.0",
        scope: { date: "2026-09-26", service: "liturgy" },
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

test("legacy одиночный пакет: сшивка, молчания, заглушка", () => {
    const parsed = parsePackage(pkg(LEGACY));
    assert.equal(parsed.beda.length, 0);
    assert.equal(parsed.day?.feast_label, "предпразднство");
    assert.equal(parsed.services.length, 1);

    const s = parsed.services[0];
    assert.equal(s.key, "liturgy");
    assert.equal(s.ukazaniya, null);
    const [formula, position] = s.steps as any[];
    // формула канвы — при своём тексте, права её не касались
    assert.equal(formula.text, "Святый Боже");
    const [withBody, placeholder, empty, unnamed] = position.items;
    assert.equal(withBody.text, "Блажен муж");
    assert.equal(withBody.edition, "menaion");
    // заглушка «престол не выбран» — часть канвы: слово о молчании её не затирает
    assert.equal(placeholder.text, "(престол не выбран)");
    assert.equal(placeholder.absent, "unset");
    assert.equal(empty.text, "‹текста нет: не собран›");
    // строки вовсе нет в указателе — честное слово вместо отсутствия ключа
    assert.equal(unnamed.text, "‹текста нет: пакет о нём не говорит›");
});

const DAY11 = {
    "mimetype": "application/vnd.ordo+zip",
    "manifest.json": JSON.stringify({
        format: "posledovanie", spec_version: "1.1",
        scope: { date: "2026-09-26", variant: "ustavny", services: ["vespers", "liturgy"] },
        gates: "rights", license: "CC-BY-4.0",
        body_counts: { present: 2, external: 1 },
        services_counts: { vespers: { present: 1 }, liturgy: { present: 1, external: 1 } },
    }),
    "ordo.json": JSON.stringify({
        date: "2026-09-26",
        day: { weekday: "subbota", tone: 7 },
        variants: [{ key: "ustavny", label: "Славословная" }],
    }),
    "services/vespers.json": JSON.stringify({
        key: "vespers", label: "Вечерня", ordo: "vespers-daily",
        rules: [], steps: [
            { kind: "position", label: "Стихиры", items: [{ address: "mineya-1" }] },
        ],
        ukazaniya: [{ kind: "p", plain: true, runs: [{ t: "Глас 7" }] }],
    }),
    "services/liturgy.json": JSON.stringify({
        key: "liturgy", label: "Литургия", ordo: "liturgy",
        rules: [], steps: [
            { kind: "position", label: "Апостол", items: [{ address: "bible:1-kor.14.20-25" }] },
        ],
        ukazaniya: [],
    }),
    "addresses.json": JSON.stringify({
        spec: "1.1",
        lines: [
            { service: "vespers", step: 0, item: 0, address: "mineya-1",
              edition: "menaion", body: { in: "texts/menaion.jsonl", line: 0 } },
            { service: "liturgy", step: 0, item: 0, address: "bible:1-kor.14.20-25",
              body: { absent: "external" } },
        ],
        memories: {},
    }),
    "texts/menaion.jsonl": '{"address":"mineya-1","text":"Блажен муж"}\n',
};

test("формат 1.1: день с двумя службами, указания, Писание адресом", () => {
    const parsed = parsePackage(pkg(DAY11));
    assert.equal(parsed.beda.length, 0);
    assert.equal(parsed.day?.day?.weekday, "subbota");
    assert.equal(parsed.services.length, 2);
    assert.deepEqual(parsed.services.map(s => s.key), ["vespers", "liturgy"]);

    const [vespers, liturgy] = parsed.services;
    assert.equal(vespers.label, "Вечерня");
    assert.equal((vespers.steps[0] as any).items[0].text, "Блажен муж");
    assert.equal(vespers.ukazaniya?.length, 1);
    // вечерня не получила чужие строки: у неё одна единица
    assert.equal((vespers.steps[0] as any).items.length, 1);

    const item = (liturgy.steps[0] as any).items[0];
    assert.equal(item.text, "‹текст снаружи: Писание›");
    assert.equal(item.absent, "external");
    assert.deepEqual(scriptureRefs(parsed.services), ["bible:1-kor.14.20-25"]);
});

test("битая ссылка на тело — beda, а не падение", () => {
    const broken = {
        ...LEGACY,
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
    assert.equal(parsed.day, null);
    assert.equal(parsed.services.length, 0);
    assert.ok(parsed.beda.some(b => b.includes("ordo.json")));
});

test("братья по адресу поднимаются к строке", () => {
    const withAlt = {
        ...LEGACY,
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
    const item = (parsed.services[0].steps[1] as any).items[0];
    assert.equal(item.text, "Блажен муж");
    assert.equal(item.parallel.length, 2);
    assert.equal(item.parallel[0].text, "Μακάριος");
    assert.equal(item.parallel[1].absent, "not-collected");
});

const MANUAL = {
    "mimetype": "application/vnd.ordo+zip",
    "manifest.json": JSON.stringify({
        format: "posledovanie", spec_version: "1.1",
        scope: { date: null, service: "vespers-daily",
                 coordinates: { month: 9, day: 13, sign: null,
                                day_variant: "sedmichny", feast: null, oktoih: null } },
        use: { ustav: "jerusalem/rus-synodal", rite: "jerusalem",
               tradition: "rus-synodal", label: "Иерусалимский",
               style: "julian", paschalia: "julian", known: true },
        gates: "none", bodies_requested: "internal",
    }),
    "ordo.json": JSON.stringify({ date: null, manual: true }),
    "services/vespers-daily.json": JSON.stringify({
        key: "vespers-daily", ordo: "vespers-daily",
        requested_ordo: "vespers-daily", switched_from: null, typikon_would: null,
        context: { month: 9, day: 13, day_variant: "sedmichny" },
        memories: [{ memory_id: "mineya-09-13-1", label: "Память" }],
        rules: [], steps: [{ kind: "text", label: "Молитва", text: "Святый Боже" }],
        ukazaniya: [],
    }),
    "addresses.json": JSON.stringify({ spec: "1.1", lines: [], memories: {} }),
};

test("ручной пакет: координаты в scope, контекст и памяти у службы", () => {
    const parsed = parsePackage(pkg(MANUAL));
    assert.equal(parsed.day?.manual, true);
    assert.equal(parsed.manifest?.scope?.date, null);
    assert.deepEqual(parsed.manifest?.scope?.coordinates, {
        month: 9, day: 13, sign: null, day_variant: "sedmichny", feast: null, oktoih: null,
    });
    assert.equal(parsed.manifest?.use?.label, "Иерусалимский");
    const s = parsed.services[0];
    assert.equal(s.context?.month, 9);
    assert.deepEqual(s.memories, [{ memoryId: "mineya-09-13-1", label: "Память" }]);
    assert.equal(s.requestedOrdo, "vespers-daily");
});
