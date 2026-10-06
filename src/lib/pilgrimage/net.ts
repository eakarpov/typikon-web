// Сетевой слой обходчиков сайтов храмов: один запрос с ручными
// перенаправлениями, проверка адреса, кодировка. Вынесен из
// crawl-temple-sites.ts, когда обходчиков стало два (святыни и престолы):
// вежливость и безопасность у них общие и должны быть одним кодом, а не двумя
// похожими.
//
// ВЕЖЛИВОСТЬ И БЕЗОПАСНОСТЬ ЗДЕСЬ НЕ НАСТРОЕНИЕ, А УСЛОВИЕ.
//   * Адреса сайтов взяты из открытых данных. Прежде каждого запроса и на
//     каждом шаге перенаправления имя разрешается и сверяется: частные и
//     локальные адреса запрещены — иначе запись каталога вида
//     http://127.0.0.1:8767 отправила бы обходчик на сервере в нашу службу.
//   * Порты — только 80, 443 и 8080: обходчик ходит по обычному вебу, а не
//     стучится в чужие службы.
//   * Тело читается не больше maxBytes: приходские сайты живут на дешёвых
//     хостингах, и страница в десяток мегабайт для них — беда.
//
// Кодировка: из заголовка, затем из <meta charset> в начале документа, иначе
// UTF-8. Windows-1251 на приходских сайтах обычна, и без неё текст приходит
// ромбами.

import { CRAWLER_UA, isPrivateAddress } from "./crawl";

export class Refused extends Error {}

export interface Fetched { url: URL; status: number; body: string; contentType: string }

export interface FetcherOptions {
    /** Только для проверки на своей машине: пускает к localhost и ни к каким иным частным адресам. */
    allowLocal?: boolean;
    /** Предел тела ответа: остальное обрывается. */
    maxBytes?: number;
    timeoutMs?: number;
}

export interface Fetcher {
    get: (start: URL, accept?: string) => Promise<Fetched>;
    /** Разрешён ли хост и не частный ли он: проверено и запомнено. */
    hostIsPublic: (hostname: string) => Promise<boolean>;
}

/** Кодировка ответа: из заголовка, из <meta> в начале документа, иначе UTF-8. */
const charsetOf = (contentType: string | null, head: Buffer): string => {
    const fromHeader = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1];
    const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head.toString("latin1"))?.[1];
    const label = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
    try { new TextDecoder(label); return label; } catch { return "utf-8"; }
};

/**
 * Обходчик на один прогон. Хост разрешается и проверяется один раз и
 * запоминается: повторный запрос к тому же сайту не должен снова ждать DNS.
 */
export const createFetcher = (opts: FetcherOptions = {}): Fetcher => {
    const allowLocal = opts.allowLocal ?? false;
    const maxBytes = opts.maxBytes ?? 1_500_000;
    const timeoutMs = opts.timeoutMs ?? 15_000;
    const checkedHosts = new Map<string, boolean>();

    const hostIsPublic = async (hostname: string): Promise<boolean> => {
        if (allowLocal && (hostname === "localhost" || hostname === "127.0.0.1")) return true;
        if (checkedHosts.has(hostname)) return checkedHosts.get(hostname)!;
        let ok = false;
        try {
            const addrs = await (await import("node:dns/promises")).lookup(hostname, { all: true });
            ok = addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
        } catch { ok = false; }
        checkedHosts.set(hostname, ok);
        return ok;
    };

    /** Запрос с ручными перенаправлениями: каждый шаг проверяется так же, как первый. */
    const get = async (start: URL, accept = "text/html,application/xhtml+xml"): Promise<Fetched> => {
        let url = start;
        for (let hop = 0; hop < 5; hop++) {
            if (url.protocol !== "http:" && url.protocol !== "https:") throw new Refused(`схема ${url.protocol}`);
            if (url.port && !["80", "443", "8080"].includes(url.port) && !allowLocal) throw new Refused(`порт ${url.port}`);
            if (!(await hostIsPublic(url.hostname))) throw new Refused(`частный или неразрешимый адрес: ${url.hostname}`);

            const res = await fetch(url, {
                redirect: "manual",
                signal: AbortSignal.timeout(timeoutMs),
                headers: { "User-Agent": CRAWLER_UA, Accept: accept, "Accept-Language": "ru,en;q=0.5" },
            });
            if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
                url = new URL(res.headers.get("location")!, url);
                await res.body?.cancel();
                continue;
            }

            const chunks: Buffer[] = [];
            let size = 0;
            if (res.body) {
                const reader = res.body.getReader();
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(Buffer.from(value));
                    size += value.length;
                    if (size >= maxBytes) { await reader.cancel(); break; }
                }
            }
            const raw = Buffer.concat(chunks);
            const contentType = res.headers.get("content-type") ?? "";
            const body = new TextDecoder(charsetOf(contentType, raw.subarray(0, 2048))).decode(raw);
            return { url, status: res.status, body, contentType };
        }
        throw new Refused("слишком много перенаправлений");
    };

    return { get, hostIsPublic };
};
