import "@/scripts/lib/env";
import { parsePackage } from "@/lib/ordoPackageReader";

// Паритет двух путей к одной службе: JSON-выдачи движка (/sutki, /ordo) и
// пакет .ordo (GET /package, формат 1.1). Переезд сайта на пакет честен,
// только когда оба пути дают одну службу: этот скрипт и есть та сверка.
// Сравниваются шаги (порядок, поля, тексты), «Богослужебные указания» из
// пакета против ручки /ukazaniya, таблицы подач и полный устав (manifest.use
// против поля ustav); ручная сборка (конструктор) сверяется с ручкой /ordo.
//
// Прогон (служба устава должна быть поднята, ORDO_SERVICE_URL — в окружении):
//   npx tsx src/scripts/check-ordo-parity.ts
// Выход ненулевой при любом расхождении; расхождения печатаются с адресом
// первой разошедшейся строки.

const BASE = process.env.ORDO_SERVICE_URL || "http://127.0.0.1:8767";

const DATES = ["2026-09-21", "2026-09-26", "2026-09-27", "2026-04-12"];
const USTAVY = ["", "pre-nikonian/old-rite"];

const get = async (path: string): Promise<any> => {
    const response = await fetch(`${BASE}${path}`);
    if (!response.ok) {
        throw new Error(`${path}: HTTP ${response.status}`);
    }
    return response.json();
};

const getBytes = async (path: string): Promise<Uint8Array> => {
    const response = await fetch(`${BASE}${path}`);
    if (!response.ok) {
        const said = await response.json().then(b => b?.error, () => null);
        throw new Error(`${path}: HTTP ${response.status}${said ? ` ${said}` : ""}`);
    }
    return new Uint8Array(await response.arrayBuffer());
};

/** Сравнение показа: подача (display) и пометы читателя (absent) исключены —
 *  пакет нейтрален к подаче нарочно (spec/package.md), а absent правду несёт
 *  уже через текст. «Пакет о нём не говорит» — страховка указателя, /sutki
 *  там несёт null, и показ (Line не рисует пустое) одинаков. */
const NET_WORD = "‹текста нет: пакет о нём не говорит›";

const stripReaderMarks = (steps: any[]): any[] =>
    steps.map((step: any) => {
        const { display: _d, ...rest } = step;
        return {
            ...rest,
            items: (rest.items ?? []).map((it: any) => {
                const { display: _d2, absent: _a, ...itemRest } = it;
                if (itemRest.text == null || itemRest.text === NET_WORD) delete itemRest.text;
                if (it.step) itemRest.step = stripReaderMarks([it.step])[0];
                return itemRest;
            }),
        };
    });

const firstDiff = (a: any, b: any, path: string): string | null => {
    if (Object.is(a, b)) return null;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return `${path}: длина ${a.length} ≠ ${b.length}`;
        for (let i = 0; i < a.length; i++) {
            const d = firstDiff(a[i], b[i], `${path}[${i}]`);
            if (d) return d;
        }
        return null;
    }
    if (a && b && typeof a === "object" && typeof b === "object") {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of [...keys].sort()) {
            const d = firstDiff(a[k], b[k], `${path}.${k}`);
            if (d) return d;
        }
        return null;
    }
    return `${path}: ${JSON.stringify(a) ?? "null"} ≠ ${JSON.stringify(b) ?? "null"}`;
};

const canon = (v: any): string => {
    if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
    if (v && typeof v === "object") {
        return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v) ?? "null";
};

const run = async () => {
    let checked = 0;
    const failures: string[] = [];

    for (const date of DATES) {
        for (const ustav of USTAVY) {
            const u = ustav ? `&ustav=${encodeURIComponent(ustav)}` : "";
            const tag = `${date}${u ? ` ${ustav}` : ""}`;
            const sutki = await get(`/sutki?date=${date}${u}`);
            const viewRules = await get(`/view-rules`);
            if (canon(viewRules) !== canon(sutki.view_rules)) {
                failures.push(`${tag}: view_rules ≠ /view-rules`);
            }

            const parsed = parsePackage(await getBytes(`/package?date=${date}&bodies=internal${u}`));
            if (parsed.beda.length) failures.push(`${tag}: сшивка: ${parsed.beda.join("; ")}`);
            if (canon(parsed.manifest?.use ?? null) !== canon(sutki.ustav ?? null)) {
                failures.push(`${tag}: manifest.use ≠ ustav ответа /sutki`);
            }
            const byKey = new Map(parsed.services.map(s => [s.key, s]));
            if (parsed.services.length !== (sutki.services ?? []).length) {
                failures.push(`${tag}: служб в пакете ${parsed.services.length}, в /sutki ${(sutki.services ?? []).length}`);
            }

            for (const service of sutki.services ?? []) {
                const pkgService = byKey.get(service.key);
                const stag = `${tag} ${service.key}`;
                if (!pkgService) {
                    failures.push(`${stag}: нет в пакете`);
                    continue;
                }
                const stepDiff = firstDiff(
                    stripReaderMarks(service.steps), stripReaderMarks(pkgService.steps), "steps");
                if (stepDiff) failures.push(`${stag}: шаги: ${stepDiff}`);

                const ukaz = await get(`/ukazaniya?date=${date}&service=${service.key}${u}`);
                const pkgUkaz = pkgService.ukazaniya ?? [];
                const ukazDiff = firstDiff(service.ukazaniya ?? [], pkgUkaz, "ukazaniya");
                if (ukazDiff) failures.push(`${stag}: указания в пакете: ${ukazDiff}`);
                const ukazRouteDiff = firstDiff(pkgUkaz, ukaz, "ukazaniya");
                if (ukazRouteDiff) failures.push(`${stag}: указания ≠ ручка /ukazaniya: ${ukazRouteDiff}`);

                checked++;
                process.stdout.write(`\rпроверено служб: ${checked}`);
            }
        }
    }
    process.stdout.write("\n");

    // РУЧНАЯ СБОРКА (конструктор): пакет по координатам ≡ JSON-ручка /ordo.
    // Пометы читателя (display/absent) не сравниваются — пакет нейтрален.
    const MANUAL = [
        "ordo=jerusalem-rus-synodal-vespers-daily&month=9&day=13",
        "ordo=jerusalem-rus-synodal-liturgy-chrysostom&month=4&day=12&sign=slavoslovie",
    ];
    for (const coords of MANUAL) {
        const o = await get(`/ordo?${coords}`);
        const parsed = parsePackage(await getBytes(`/package?${coords}&bodies=internal`));
        const stag = `ручная: ${coords.slice(0, 60)}`;
        if (parsed.beda.length) failures.push(`${stag}: сшивка: ${parsed.beda.join("; ")}`);
        const built = parsed.services[0];
        if (!built) {
            failures.push(`${stag}: службы нет в пакете`);
            continue;
        }
        const d = firstDiff(
            stripReaderMarks(built.steps), stripReaderMarks(o.steps), "steps");
        if (d) failures.push(`${stag}: шаги: ${d}`);
        if (canon(parsed.manifest?.scope?.coordinates ?? null) == null) {
            failures.push(`${stag}: нет scope.coordinates`);
        }
        checked++;
        process.stdout.write(`\rпроверено служб: ${checked}`);
    }
    process.stdout.write("\n");

    if (failures.length) {
        console.log(`РАСХОЖДЕНИЙ: ${failures.length}`);
        for (const f of failures.slice(0, 40)) console.log(`  ${f}`);
        if (failures.length > 40) console.log(`  … и ещё ${failures.length - 40}`);
        process.exit(1);
    }
    console.log(`паритет чист: ${checked} служб, даты ${DATES.join(", ")}`);
};

run().catch(e => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
});
