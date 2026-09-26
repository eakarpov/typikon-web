// Чтение пакета `.ordo` — формата обмена последованием (typikon-rules,
// spec/package.md). Просмотрщик /posledovanie читает службу отсюда, а не из
// JSON-ручки /sutki: пакет и есть внешний формат, и читая его, сайт ест свой
// же контракт, а не параллельный путь к той же службе.
//
// Что здесь и зачем, в терминах спеки:
//   ordo.json      порядок службы: шаги с единицами БЕЗ тел и без подачи
//                  (display накладывает читатель, см. lib/ordoView.ts);
//   addresses.json где лежит тело каждой строки — сшиваем по МЕСТУ (шаг,
//                  единица), а не по адресу: один адрес бывает положен дважды;
//   texts/*.jsonl  тела, файл на издание, строка на адрес.
// Молчания (rights, not-collected, external, omitted, unset) различаются —
// свести их в одно «нет текста» значит соврать складно. Порт posledovanie()
// из typikon-rules/src/package.py: поведение совпадает с эталонным читателем,
// и расхождения ловит scripts/check-ordo-parity.ts.
import { unzipSync } from "fflate";
import { cached, CacheTag } from "@/lib/cache";
import { reportError } from "@/lib/reportError";
import type { OrdoRule, OrdoStep, OrdoUkazParagraph, OrdoViewRules } from "@/lib/ordo";
import type { OrdoTransfer } from "@/lib/ordo";

// Три (пять) РАЗНЫХ молчания — те же слова, что и в typikon-rules/src/package.py:
// читатель пакета обязан говорить о них одинаково на всяком языке программ.
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

export interface OrdoPackageQuery {
    date: string;
    ustav?: string;
    variant?: string;
    service: string;
    lang?: string;
    parallel?: string;
    psalms?: string;
    transfers?: OrdoTransfer[];
}

export interface OrdoPackageService {
    key: string;
    steps: OrdoStep[];
    rules: OrdoRule[];
    feastLabel: string | null;
    /** Версия движка (X-Ordo-Version ответа) — для диагностики и панели. */
    version: string | null;
}

type Asked<T> = { data: T; error: null; version: string | null }
    | { data: null; error: string; version: string | null };

const base = () => process.env.ORDO_SERVICE_URL || "";

// ОДИН ПОВТОР на обрыв соединения — та же причина, что в lib/ordo.ts:
// служба отвечает по HTTP/1.0 и закрывает сокет после ответа, и клиент,
// спрашивающий её разом многими запросами (суточный круг — десяток служб,
// к каждой пакет и указания), изредка попадает в уже закрытое соединение.
// «fetch failed» тут значит «до службы не дошло», и один повтор дешевле
// ложной «не собралась». Тайм-аут не повторяем: служба занята, и второй
// заход её не разгрузит.
const fetchOk = async (url: URL, timeoutMs: number): Promise<Response> => {
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(timeoutMs),
                cache: "no-store",
            });
            if (!response.ok) {
                const said = await response.json().then(b => b?.error, () => null);
                throw new Error(`${response.status}${said ? `: ${said}` : ""}`);
            }
            return response;
        } catch (e) {
            const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
            if (attempt < 2 && !timedOut) continue;
            throw e;
        }
    }
};

const transferParam = (t: OrdoTransfer): [string, string] =>
    ["add_memory", t.primary ? `${t.memoryId}:primary` : t.memoryId];

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
            out[name] = JSON.parse(text);
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

/**
 * Сшить шаги службы с телами — чтение пакета (package.posledovanie в Python).
 * Возвращает шаги в той же форме, в какой их отдаёт сборка: дальше их ждёт
 * тот же показ, что и прежде для /sutki.
 */
const stitch = (pkg: PackageFiles): { steps: OrdoStep[]; beda: string[] } => {
    const beda: string[] = [];
    const ordo = pkg["ordo.json"];
    if (!ordo || typeof ordo !== "object") {
        return { steps: [], beda: ["нет ordo.json — канвы в пакете нет"] };
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
        return { steps, beda: [...beda, "нет addresses.json — канва показана без тел"] };
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
        const item = items[j];
        const absent = entry.body?.absent ?? null;
        if (absent === "unset" && item.text) {
            // Заглушку не заменяем словом о молчании — она часть канвы и
            // едет в ordo.json; помету ставим, текст бережём (как в
            // package.posledovanie, typikon-rules).
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
    return { steps, beda };
};

/** Каждой строке — ключ `text`, даже если о ней пакет не говорит вовсе. */
const bezTel = (steps: OrdoStep[]) => {
    for (const step of steps) {
        for (const item of (step.items ?? []) as any[]) {
            if (!("text" in item)) item.text = NET_V_UKAZATELE;
        }
    }
};

const request = async (query: OrdoPackageQuery): Promise<Asked<OrdoPackageService>> => {
    const root = base();
    if (!root) return { data: null, error: "служба устава не настроена (ORDO_SERVICE_URL)", version: null };

    const url = new URL("/package", root);
    url.searchParams.set("date", query.date);
    url.searchParams.set("service", query.service);
    url.searchParams.set("bodies", "internal");
    for (const [k, v] of Object.entries({
        ustav: query.ustav, variant: query.variant, lang: query.lang,
        parallel: query.parallel, psalms: query.psalms,
    })) {
        if (v) url.searchParams.set(k, v);
    }
    for (const t of query.transfers ?? []) {
        url.searchParams.append(...transferParam(t));
    }

    try {
        const response = await fetchOk(url, 25_000);
        const pkg = unpack(new Uint8Array(await response.arrayBuffer()));
        const { steps, beda } = stitch(pkg);
        if (beda.length) {
            reportError(new Error("пакет последования сшит с расхождениями"), {
                where: "lib/ordoPackage: расхождения пакета",
                extra: { date: query.date, service: query.service, beda },
            });
        }
        const ordo = pkg["ordo.json"] ?? {};
        return {
            data: {
                key: query.service,
                steps,
                rules: ordo.rules ?? [],
                feastLabel: ordo.feast_label ?? null,
                version: response.headers.get("x-ordo-version"),
            },
            error: null,
            version: response.headers.get("x-ordo-version"),
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        reportError(e, { where: "lib/ordoPackage: служба устава недоступна", extra: { path: url.pathname } });
        return { data: null, error: message, version: null };
    }
};

/** Разобрать байты пакета в шаги службы. Чистая функция — ей же пользуется
 *  scripts/check-ordo-parity.ts, сверяя пакет с JSON-выдачей /sutki. */
export const parsePackage = (bytes: Uint8Array): { steps: OrdoStep[]; beda: string[] } =>
    stitch(unpack(bytes));

/** Служба суток из пакета: шаги с привязанными телами, без подачи. */
export const ordoPackage = (query: OrdoPackageQuery): Promise<Asked<OrdoPackageService>> =>
    request(query);

const viewRulesRequest = async (): Promise<OrdoViewRules> => {
    const root = base();
    if (!root) throw new Error("служба устава не настроена (ORDO_SERVICE_URL)");
    const response = await fetchOk(new URL("/view-rules", root), 8_000);
    return await response.json() as OrdoViewRules;
};

// Таблицы подач статичны на жизнь выкладки движка: кэш час с тем же тегом ordo,
// что и прочие ответы службы, — сброс выкладкой, верхняя граница час.
const viewRulesCached = cached(viewRulesRequest, ["ordo-view-rules"], [CacheTag.ORDO]);

/** Таблицы подач из реестра движка (spec/registry/views.yaml). */
export const ordoViewRules = async (): Promise<OrdoViewRules | null> => {
    try {
        return await viewRulesCached();
    } catch (e) {
        reportError(e, { where: "lib/ordoPackage: view-rules недоступны" });
        return null;
    }
};

export interface OrdoUkazaniyaQuery {
    date: string;
    service: string;
    ustav?: string;
    variant?: string;
}

const ukazaniyaRequest = async (query: OrdoUkazaniyaQuery): Promise<OrdoUkazParagraph[]> => {
    const root = base();
    if (!root) throw new Error("служба устава не настроена (ORDO_SERVICE_URL)");
    const url = new URL("/ukazaniya", root);
    url.searchParams.set("date", query.date);
    url.searchParams.set("service", query.service);
    if (query.ustav) url.searchParams.set("ustav", query.ustav);
    if (query.variant) url.searchParams.set("variant", query.variant);
    const response = await fetchOk(url, 25_000);
    return await response.json() as OrdoUkazParagraph[];
};

/** Абзацы «Богослужебных указаний» — в пакет они не входят (это рассказ о
 *  службе, а не канва), и живут отдельной ручкой. */
export const ordoUkazaniya = async (query: OrdoUkazaniyaQuery): Promise<Asked<OrdoUkazParagraph[]>> => {
    try {
        return { data: await ukazaniyaRequest(query), error: null, version: null };
    } catch (e) {
        return { data: null, error: e instanceof Error ? e.message : String(e), version: null };
    }
};
