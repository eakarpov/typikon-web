// Чистый читатель пакета `.ordo` — без серверных зависимостей: тот же код
// работает в Node (серверный просмотрщик, lib/ordoPackage.ts) и в браузере
// (загрузка файла в /posledovanie). Чтение в терминах спеки (typikon-rules,
// spec/package.md), формат 1.1 — день целиком:
//
//   manifest.json      scope.services — ключи служб пакета
//   ordo.json          ДЕНЬ без шагов (варианты, памяти, контекст)
//   services/<ключ>.json   служба: шаги БЕЗ тел и подачи, rules, ukazaniya
//   addresses.json     строки тел {service, step, item, …}: тела сшиваются
//                      по МЕСТУ, а не по адресу — адрес бывает положен дважды
//   texts/*.jsonl      тела, общий пул
//
// Читаем и прежнюю одиночную форму (ordo.json.steps, строки без service) —
// старые скачанные файлы должны открываться. Молчания (rights, not-collected,
// external, omitted, unset) различаются — свести их в одно «нет текста»
// значит соврать складно. Поведение держится паритетом
// scripts/check-ordo-parity.ts против JSON-выдачи /sutki.
import { unzipSync } from "fflate";
import type { OrdoRule, OrdoStep, OrdoUkazParagraph } from "@/lib/ordo";

// Те же слова, что и в typikon-rules/src/package.py: читатель пакета говорит
// о молчаниях одинаково на всяком языке программ.
const ABSENT_WORDS: Record<string, string> = {
    "rights": "‹текста нет: отдать не вправе›",
    "not-collected": "‹текста нет: не собран›",
    "external": "‹текст снаружи: Писание›",
    "omitted": "‹текста нет: не просили›",
    "unset": "‹текста нет: не задано настройкой›",
};
const NET_V_UKAZATELE = "‹текста нет: пакет о нём не говорит›";

interface JsonlRow { address?: string; language?: string | null; text?: string }

interface PackageFiles {
    "manifest.json"?: any;
    "ordo.json"?: any;
    "addresses.json"?: any;
    "rights.json"?: any;
    [name: string]: any;
}

export interface ParsedService {
    key: string;
    label: string | null;
    steps: OrdoStep[];
    rules: OrdoRule[];
    feastLabel: string | null;
    /** Абзацы «Богослужебных указаний»; null — legacy-пакет, где их нет. */
    ukazaniya: OrdoUkazParagraph[] | null;
    placementWhy: string | null;
    replacedBy: string | null;
    /** Место службы в сутках — у ручного пакета null. */
    stoyanie: string | null;
    civil: string | null;
    part: string | null;
    partLabel: string | null;
    layers: string[];
    // Ручная сборка (конструктор): у дневных служб — null/пусто.
    context: Record<string, any> | null;
    memories: { memoryId: string; label: string }[];
    requestedOrdo: string | null;
    switchedFrom: string | null;
    typikonWould: string | null;
    /** Не собралась — и почему; шаги тогда пусты. */
    error: string | null;
    ordo: string | null;
}

export interface ParsedPackage {
    manifest: any;
    /** ordo.json: день без шагов (варианты, памяти, контекст). */
    day: any;
    services: ParsedService[];
    /** Расхождения сшивки: битые ссылки, строки мимо шагов. */
    beda: string[];
}

/** Распаковать и разобрать zip пакета в словарь частей. */
const unpack = (bytes: Uint8Array): PackageFiles => {
    const raw = unzipSync(bytes);
    const out: PackageFiles = {};
    for (const [name, data] of Object.entries(raw)) {
        const text = new TextDecoder("utf-8").decode(data);
        if (name.endsWith(".jsonl")) {
            out[name] = text.split("\n").filter(Boolean).map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return { text: line }; // битая строка не роняет чтение
                }
            });
        } else if (name.endsWith(".json")) {
            try {
                out[name] = JSON.parse(text);
            } catch {
                // не-JSON часть — пропускаем: деградация, а не падение
            }
        }
    }
    return out;
};

/** Тело строки: сам текст либо честное слово о том, почему его нет. */
const bodyText = (pkg: PackageFiles, body: any): { text: string | null; why: string | null } => {
    if (body?.in) {
        const rows = (pkg[body.in] ?? []) as JsonlRow[];
        const line = body.line;
        if (Number.isInteger(line) && line >= 0 && line < rows.length) {
            return { text: rows[line]?.text ?? null, why: null };
        }
        return { text: null, why: `${body.in}: строки ${line} нет` };
    }
    const absent = body?.absent;
    return { text: ABSENT_WORDS[absent] ?? `‹текста нет: ${absent}›`, why: null };
};

/** Каждой строке — ключ `text`, даже если о ней пакет не говорит вовсе. */
const bezTel = (steps: OrdoStep[]) => {
    for (const step of steps) {
        for (const item of (step.items ?? []) as any[]) {
            if (!("text" in item)) item.text = NET_V_UKAZATELE;
        }
    }
};

/** Шаги службы с привязанными телами: ordo.json даёт порядок, addresses —
 *  где лежит тело каждой строки. Шаги возвращаются в форме сборки. */
const stitchService = (
    pkg: PackageFiles,
    part: any,
    lines: any[],
    beda: string[],
): OrdoStep[] => {
    const steps: OrdoStep[] = JSON.parse(JSON.stringify(part?.steps ?? []));

    // Формула, снятая воротами, говорит о себе сама
    for (const step of steps) {
        const absent = (step as any).body_absent;
        if (absent && !(step as any).text) {
            (step as any).text = ABSENT_WORDS[absent] ?? `‹текста нет: ${absent}›`;
        }
    }

    for (const entry of lines) {
        const i = entry.step, j = entry.item;
        if (!Number.isInteger(i) || i < 0 || i >= steps.length) {
            beda.push(`строка указывает на шаг ${i}, а шагов ${steps.length}`);
            continue;
        }
        const items = (steps[i].items ?? []) as any[];
        if (!Number.isInteger(j) || j < 0 || j >= items.length) {
            beda.push(`шаг ${i}: строка указывает на единицу ${j}, а их ${items.length}`);
            continue;
        }
        const item = items[j];
        const absent = entry.body?.absent ?? null;
        if (absent === "unset" && item.text) {
            // Заглушку не заменяем словом о молчании — она часть канвы и
            // едет в services/<ключ>.json; помету ставим, текст бережём.
            item.absent = absent;
        } else {
            const { text, why } = bodyText(pkg, entry.body ?? {});
            if (why) beda.push(`шаг ${i}, единица ${j}: ${why}`);
            item.text = text;
        }
        for (const key of ["address", "edition", "language", "cite", "source_url", "part", "zachalo"]) {
            if (entry[key] != null && item[key] == null) item[key] = entry[key];
        }
        if (absent && item.absent == null) item.absent = absent;
        // БРАТЬЯ ПО АДРЕСУ — та же строка на других языках, рядом с ней.
        const brothers: any[] = [];
        for (const alt of entry.alternates ?? []) {
            const bro = bodyText(pkg, alt.body ?? {});
            if (bro.why) beda.push(`шаг ${i}, единица ${j}: ${bro.why}`);
            brothers.push({
                language: alt.language, edition: alt.edition, basis: alt.basis,
                absent: alt.body?.absent ?? null, text: bro.text,
            });
        }
        if (brothers.length) item.parallel = brothers;
    }
    bezTel(steps);
    return steps;
};

const toService = (part: any, steps: OrdoStep[]): ParsedService => ({
    key: part?.key ?? "service",
    label: part?.label ?? null,
    steps,
    rules: part?.rules ?? [],
    feastLabel: part?.feast_label ?? null,
    ukazaniya: part?.ukazaniya ?? null,
    placementWhy: part?.placement_why ?? null,
    replacedBy: part?.replaced_by ?? null,
    stoyanie: part?.stoyanie ?? null,
    civil: part?.civil ?? null,
    part: part?.part ?? null,
    partLabel: part?.part_label ?? null,
    layers: part?.layers ?? [],
    context: part?.context ?? null,
    memories: (part?.memories ?? []).map((m: any) => ({ memoryId: m.memory_id, label: m.label })),
    requestedOrdo: part?.requested_ordo ?? null,
    switchedFrom: part?.switched_from ?? null,
    typikonWould: part?.typikon_would ?? null,
    error: part?.error ?? null,
    ordo: part?.ordo ?? null,
});

/** Чтение пакета: формат 1.1 (день, services/<ключ>.json) или прежний
 *  одиночный (ordo.json.steps). Не пакет — day: null и честная beda. */
export const parsePackage = (bytes: Uint8Array): ParsedPackage => {
    const pkg = unpack(bytes);
    const beda: string[] = [];
    const manifest = pkg["manifest.json"] ?? null;
    const addresses = pkg["addresses.json"];
    const lines: any[] = (addresses && typeof addresses === "object") ? (addresses.lines ?? []) : [];
    const dayPart = (pkg["ordo.json"] && typeof pkg["ordo.json"] === "object") ? pkg["ordo.json"] : null;

    const dayKeys = Object.keys(pkg).filter(n => n.startsWith("services/") && n.endsWith(".json"));
    if (dayKeys.length > 0) {
        // Формат 1.1: день без шагов + службы частями; порядок — manifest
        const order: string[] = (manifest?.scope?.services ?? dayKeys.map(k => k.slice("services/".length, -5)));
        const services = order.map(key => {
            const part = pkg[`services/${key}.json`];
            if (!part || typeof part !== "object") {
                beda.push(`services/${key}.json нет в пакете`);
                return toService({ key }, []);
            }
            const own = lines.filter(l => l.service === key);
            return toService(part, stitchService(pkg, part, own, beda));
        });
        return { manifest, day: dayPart, services, beda };
    }

    if (!dayPart) {
        return { manifest, day: null, services: [], beda: ["нет ordo.json — это не пакет последования"] };
    }
    if (!Array.isArray((dayPart as any).steps)) {
        return { manifest, day: dayPart, services: [], beda: ["ordo.json без steps, а служб в пакете нет"] };
    }
    // Прежняя одиночная форма: ordo.json — весь payload со steps
    const steps = stitchService(pkg, dayPart, lines, beda);
    return {
        manifest,
        day: dayPart,
        services: [toService({ ...dayPart, key: manifest?.scope?.service ?? "service" }, steps)],
        beda,
    };
};

/** Ссылки на Писание, которые читатель может дорезолвить: строки с
 *  молчанием external и адресом bible:. Пакет умышленно везёт их адресами. */
export const scriptureRefs = (services: ParsedService[]): string[] => {
    const out = new Set<string>();
    const walk = (steps: OrdoStep[]) => {
        for (const step of steps) {
            for (const item of (step.items ?? []) as any[]) {
                if (item.absent === "external" && typeof item.address === "string"
                    && item.address.startsWith("bible:")) {
                    out.add(item.address);
                }
            }
        }
    };
    for (const s of services) walk(s.steps);
    return [...out];
};
