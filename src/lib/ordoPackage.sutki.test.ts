import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { parsePackage } from "@/lib/ordoPackageReader";
import { ordoSutkiFromPackage } from "@/lib/ordoPackage";

// Публичный контракт /api/v2/ordo/services собирается из пакета. Проверяем
// маппинг: службы из services/<ключ>.json (камел-кейс, место в сутках),
// устав из manifest.use, дата/вариант из scope, viewRules — аргументом.

const pkg = (files: Record<string, string>): Uint8Array =>
    zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

const DAY = {
    "manifest.json": JSON.stringify({
        format: "posledovanie", spec_version: "1.1",
        scope: { date: "2026-09-26", variant: "ustavny", services: ["vespers", "liturgy"] },
        use: { ustav: "jerusalem/rus-synodal", rite: "jerusalem",
               tradition: "rus-synodal", label: "Иерусалимский", known: true },
    }),
    "ordo.json": JSON.stringify({ date: "2026-09-26" }),
    "services/vespers.json": JSON.stringify({
        key: "vespers", label: "Вечерня", stoyanie: "2026-09-25:vecher",
        civil: "2026-09-25", part: "vecher", part_label: "вечером",
        replaced_by: null, placement_why: null, error: null,
        ordo: "vespers-daily", feast_label: null, layers: ["l1"], rules: [],
        steps: [{ kind: "text", label: "М", text: "Святый Боже" }],
        ukazaniya: [{ kind: "p", plain: true, runs: [{ t: "Глас 7" }] }],
    }),
    "services/liturgy.json": JSON.stringify({
        key: "liturgy", label: "Литургия", stoyanie: "2026-09-26:utro",
        civil: "2026-09-26", part: "utro", part_label: "утром",
        replaced_by: "vsenoshchnoe", placement_why: "вошла во всенощное",
        error: null, ordo: "liturgy", feast_label: "праздник", layers: [],
        rules: [], steps: [], ukazaniya: [],
    }),
    "addresses.json": JSON.stringify({ spec: "1.1", lines: [], memories: {} }),
};

const VIEW_RULES = {
    views: { full: "полное последование" },
    roleAliases: {}, roleViews: {}, readPositions: [], defaultRole: {}, notebooks: [],
};

test("OrdoSutki из пакета: камел-кейс, место в сутках, устав", () => {
    const parsed = parsePackage(pkg(DAY));
    const sutki = ordoSutkiFromPackage(parsed, VIEW_RULES, "1.0.0");
    assert.equal(sutki.date, "2026-09-26");
    assert.equal(sutki.variant, "ustavny");
    assert.equal(sutki.version, "1.0.0");
    assert.equal(sutki.ustav?.label, "Иерусалимский");
    assert.equal(sutki.viewRules, VIEW_RULES);
    assert.equal(sutki.services.length, 2);

    const [vespers, liturgy] = sutki.services as any[];
    assert.equal(vespers.label, "Вечерня");
    assert.equal(vespers.partLabel, "вечером");
    assert.equal(vespers.stoyanie, "2026-09-25:vecher");
    assert.equal(vespers.steps[0].text, "Святый Боже");
    assert.equal(vespers.ukazaniya.length, 1);

    assert.equal(liturgy.replacedBy, "vsenoshchnoe");
    assert.equal(liturgy.placementWhy, "вошла во всенощное");
    assert.equal(liturgy.feastLabel, "праздник");
});

test("фильтр по service — снаружи, маппер не занимается", () => {
    const parsed = parsePackage(pkg(DAY));
    const only = {
        ...parsed,
        services: parsed.services.filter(s => s.key === "liturgy"),
    };
    const sutki = ordoSutkiFromPackage(only, VIEW_RULES, null);
    assert.equal(sutki.services.length, 1);
    assert.equal(sutki.services[0].key, "liturgy");
});
