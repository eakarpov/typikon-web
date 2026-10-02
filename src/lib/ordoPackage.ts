// Серверное чтение пакета `.ordo` — формата обмена последованием
// (typikon-rules, spec/package.md). Просмотрщик /posledovanie читает службу
// отсюда, а не из JSON-ручки /sutki: пакет и есть внешний формат, и читая
// его, сайт ест свой же контракт, а не параллельный путь к той же службе.
//
// Сам разбор — в lib/ordoPackageReader.ts: он без серверных зависимостей,
// и тем же кодом пакет читается в браузере (загрузка файла в /posledovanie).
// Здесь — сеть к службе устава, кэш таблиц подач и журналирование.
import { cached, CacheTag } from "@/lib/cache";
import { reportError } from "@/lib/reportError";
import type { OrdoUkazParagraph, OrdoViewRules } from "@/lib/ordo";
import type { OrdoTransfer } from "@/lib/ordo";
import { parsePackage, type ParsedService } from "@/lib/ordoPackageReader";

export { parsePackage };

export interface OrdoDayPackageQuery {
    date: string;
    ustav?: string;
    variant?: string;
    lang?: string;
    parallel?: string;
    psalms?: string;
    transfers?: OrdoTransfer[];
}

export interface OrdoDayPackage {
    day: any;
    services: ParsedService[];
    beda: string[];
    /** Версия движка (X-Ordo-Version ответа) — для диагностики. */
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

const request = async (query: OrdoDayPackageQuery): Promise<Asked<OrdoDayPackage>> => {
    const root = base();
    if (!root) return { data: null, error: "служба устава не настроена (ORDO_SERVICE_URL)", version: null };

    const url = new URL("/package", root);
    url.searchParams.set("date", query.date);
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
        const response = await fetchOk(url, 30_000);
        const parsed = parsePackage(new Uint8Array(await response.arrayBuffer()));
        if (parsed.beda.length) {
            reportError(new Error("пакет последования сшит с расхождениями"), {
                where: "lib/ordoPackage: расхождения пакета",
                extra: { date: query.date, beda: parsed.beda },
            });
        }
        if (!parsed.services.length) {
            return { data: null, error: parsed.beda.join("; ") || "пустой пакет", version: null };
        }
        return {
            data: {
                day: parsed.day,
                services: parsed.services,
                beda: parsed.beda,
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

/** Суточный круг дня одним пакетом: службы с телами и указаниями, без подачи. */
export const ordoDayPackage = (query: OrdoDayPackageQuery): Promise<Asked<OrdoDayPackage>> =>
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
