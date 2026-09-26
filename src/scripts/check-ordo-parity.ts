import "@/scripts/lib/env";
import { unzipSync } from "fflate";

// Паритет двух путей к одной службе: JSON-выдача /sutki и пакет .ordo
// (/package, bodies=internal). Переезд просмотрщика на пакет честен, только
// когда оба пути дают одну службу: этот скрипт и есть та сверка. Сравниваются
// шаги (порядок, поля, тексты), «Богослужебные указания» и таблицы подач.
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

const getPackage = async (path: string): Promise<Uint8Array> => {
    const response = await fetch(`${BASE}${path}`);
    if (!response.ok) {
        const said = await response.json().then(b => b?.error, () => null);
        throw new Error(`${path}: HTTP ${response.status}${said ? ` ${said}` : ""}`);
    }
    return new Uint8Array(await response.arrayBuffer());
};

/** Каноническая строка: порядок ключей объектов не значит, порядок массивов — значит. */
const canon = (v: any): string => {
    if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
    if (v && typeof v === "object") {
        return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v) ?? "null";
};

const NET_WORD = "‹текста нет: пакет о нём не говорит›";

/** Сравнение показа: подача (display) и пометы читателя (absent) исключены —
 *  пакет нейтрален к подаче нарочно (spec/package.md), а absent правду несёт
 *  уже через текст. «Пакет о нём не говорит» — страховка указателя, /sutki
 *  там несёт null, и показ (Line не рисует пустое) одинаков. */
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

const stitch = (bytes: Uint8Array): { steps: any[]; beda: string[] } => {
    // Сшивка — как в lib/ordoPackage.ts; здесь копия, чтобы скрипт не тянул
    // Next-зависимости (reportError, cache). Менять в двух местах незачем:
    // скрипт сверяет ЧИТАТЕЛЯ с /sutki, поэтому читает самостоятельно.
    const raw = unzipSync(bytes);
    const file = (name: string) => {
        const data = raw[name];
        return data ? new TextDecoder("utf-8").decode(data) : null;
    };
    const jsonl = (name: string): any[] =>
        (file(name) ?? "").split("\n").filter(Boolean).map(line => JSON.parse(line));
    const ordo = JSON.parse(file("ordo.json") ?? "null");
    const addresses = JSON.parse(file("addresses.json") ?? "null");
    const steps: any[] = JSON.parse(JSON.stringify(ordo?.steps ?? []));
    const beda: string[] = [];
    const WORDS: Record<string, string> = {
        "rights": "‹текста нет: отдать не вправе›", "not-collected": "‹текста нет: не собран›",
        "external": "‹текст снаружи: Писание›", "omitted": "‹текста нет: не просили›",
        "unset": "‹текста нет: не задано настройкой›",
    };
    const bodyText = (body: any): string | null => {
        if (body?.in) {
            const rows = jsonl(body.in);
            return Number.isInteger(body.line) && body.line < rows.length
                ? rows[body.line]?.text ?? null : null;
        }
        return WORDS[body?.absent] ?? `‹текста нет: ${body?.absent}›`;
    };
    for (const step of steps) {
        const absent = step.body_absent;
        if (absent && !step.text) step.text = WORDS[absent] ?? `‹текста нет: ${absent}›`;
    }
    if (!addresses) {
        for (const step of steps) {
            for (const item of step.items ?? []) {
                if (!("text" in item)) item.text = "‹текста нет: пакет о нём не говорит›";
            }
        }
        return { steps, beda: [...beda, "нет addresses.json"] };
    }
    for (const entry of addresses.lines ?? []) {
        const item = steps[entry.step]?.items?.[entry.item];
        if (!item) {
            beda.push(`строка указывает на (${entry.step}, ${entry.item}), а его нет`);
            continue;
        }
        const absent = entry.body?.absent ?? null;
        if (absent === "unset" && item.text) {
            item.absent = absent;
        } else {
            item.text = bodyText(entry.body ?? {});
        }
        if (absent && item.absent == null) item.absent = absent;
        for (const key of ["address", "edition", "language", "cite", "source_url", "part", "zachalo"]) {
            if (entry[key] != null && item[key] == null) item[key] = entry[key];
        }
        const brothers: any[] = [];
        for (const alt of entry.alternates ?? []) {
            brothers.push({
                language: alt.language, edition: alt.edition, basis: alt.basis,
                absent: alt.body?.absent ?? null, text: bodyText(alt.body ?? {}),
            });
        }
        if (brothers.length) item.parallel = brothers;
    }
    for (const step of steps) {
        for (const item of step.items ?? []) {
            if (!("text" in item)) item.text = "‹текста нет: пакет о нём не говорит›";
        }
    }
    return { steps, beda };
};

const run = async () => {
    let checked = 0;
    const failures: string[] = [];

    for (const date of DATES) {
        for (const ustav of USTAVY) {
            const u = ustav ? `&ustav=${encodeURIComponent(ustav)}` : "";
            const sutki = await get(`/sutki?date=${date}${u}`);
            const viewRules = await get(`/view-rules`);
            const vrDiff = canon(viewRules) !== canon(sutki.view_rules);
            if (vrDiff) failures.push(`${date}${u || " (умолч. устав)"}: view_rules ≠ /view-rules`);

            for (const service of sutki.services ?? []) {
                const tag = `${date} ${service.key}${u ? ` ${ustav}` : ""}`;
                const bytes = await getPackage(
                    `/package?date=${date}&service=${service.key}&bodies=internal${u}`);
                const { steps, beda } = stitch(bytes);
                if (beda.length) failures.push(`${tag}: сшивка: ${beda.join("; ")}`);

                const stepDiff = firstDiff(
                    stripReaderMarks(service.steps), stripReaderMarks(steps), "steps");
                if (stepDiff) failures.push(`${tag}: шаги: ${stepDiff}`);

                const ukaz = await get(`/ukazaniya?date=${date}&service=${service.key}${u}`);
                const ukazDiff = firstDiff(service.ukazaniya ?? [], ukaz, "ukazaniya");
                if (ukazDiff) failures.push(`${tag}: указания: ${ukazDiff}`);

                checked++;
                process.stdout.write(`\rпроверено служб: ${checked}`);
            }
        }
    }
    process.stdout.write("\n");

    const label = (v: any) => JSON.stringify(v);
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
