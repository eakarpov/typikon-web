// Чистый читатель пакета `.ordo` — без серверных зависимостей, чтобы тот же
// код работал и в Node (серверный просмотрщик, lib/ordoPackage.ts), и в
// браузере (загрузка файла в /posledovanie). Чтение пакета в терминах спеки
// (typikon-rules/spec/package.md):
//
//   ordo.json      порядок службы: шаги с единицами БЕЗ тел и без подачи
//                  (display накладывает читатель, см. lib/ordoView.ts);
//   addresses.json где лежит тело каждой строки — сшиваем по МЕСТУ (шаг,
//                  единица), а не по адресу: один адрес бывает положен дважды;
//   texts/*.jsonl  тела, файл на издание, строка на адрес.
//
// Молчания (rights, not-collected, external, omitted, unset) различаются —
// свести их в одно «нет текста» значит соврать складно. Поведение совпадает
// с эталонным читателем package.posledovanie() и держится паритетом
// scripts/check-ordo-parity.ts.
import { unzipSync } from "fflate";
import type { OrdoStep } from "@/lib/ordo";

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

export interface ParsedPackage {
    steps: OrdoStep[];
    /** Расхождения сшивки: битые ссылки, строки мимо шагов. Пусто — сшито чисто. */
    beda: string[];
    /** ordo.json целиком: rules (лестница), feast_label, day, context. */
    ordo: any;
    manifest: any;
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

/**
 * Чтение пакета: ordo.json даёт порядок службы, addresses.json — где лежит
 * тело каждой строки. Шаги возвращаются в той же форме, в какой их отдаёт
 * сборка: дальше их ждёт тот же показ, что и прежде для /sutki.
 */
export const parsePackage = (bytes: Uint8Array): ParsedPackage => {
    const pkg = unpack(bytes);
    const beda: string[] = [];
    const ordo = pkg["ordo.json"];
    if (!ordo || typeof ordo !== "object") {
        return { steps: [], beda: ["нет ordo.json — это не пакет последования"], ordo: null, manifest: pkg["manifest.json"] ?? null };
    }
    const steps: OrdoStep[] = JSON.parse(JSON.stringify(ordo.steps ?? []));

    // Формула, снятая воротами, говорит о себе сама
    for (const step of steps) {
        const absent = (step as any).body_absent;
        if (absent && !(step as any).text) {
            (step as any).text = ABSENT_WORDS[absent] ?? `‹текста нет: ${absent}›`;
        }
    }

    const addresses = pkg["addresses.json"];
    if (!addresses || typeof addresses !== "object") {
        bezTel(steps);
        return { steps, beda: [...beda, "нет addresses.json — канва показана без тел"], ordo, manifest: pkg["manifest.json"] ?? null };
    }

    for (const entry of (addresses.lines ?? []) as any[]) {
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
        // ОДИН АДРЕС МОЖЕТ ВСТРЕТИТЬСЯ НЕ РАЗ: песнопение бывает положено петь
        // дважды, и склеивать повторы нельзя — сшиваем по МЕСТУ.
        const item = items[j];
        const absent = entry.body?.absent ?? null;
        if (absent === "unset" && item.text) {
            // Заглушку не заменяем словом о молчании — она часть канвы и
            // едет в ordo.json; помету ставим, текст бережём.
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
    return { steps, beda, ordo, manifest: pkg["manifest.json"] ?? null };
};
