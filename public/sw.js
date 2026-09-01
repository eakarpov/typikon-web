// Service worker: офлайн-чтение и быстрый повторный заход.
//
// Правила выбраны так, чтобы не воспроизвести классическую поломку PWA, когда после
// выкладки нового билда закэшированный HTML тянет уже удалённые чанки и страница белеет:
//   * навигации (HTML) — сначала сеть, кэш только как запасной вариант в офлайне;
//   * /_next/static — можно смело из кэша: имена файлов содержат хэш содержимого,
//     при новой сборке имена другие;
//   * шрифты и картинки — из кэша, они большие и не меняются (только шрифтов 1,2 МБ);
//   * /api и личные разделы не кэшируются вовсе.
//
// Кэшей два рода, и различие между ними — главное здесь. Кэш страниц (PAGE_CACHE)
// набирается сам, из того, что человек открывал, и обрезается по числу записей:
// это «повезло, страница осталась». Отложенное (SAVED_CACHE) кладётся по кнопке,
// вместе со стилями, шрифтами и скриптами страницы, не обрезается никогда и
// переживает смену версии воркера: это «я сохранил, значит открою».
//
// Версию поднимать при изменении правил: старые кэши удаляются при активации.
const VERSION = "v2";
const SHELL_CACHE = `typikon-shell-${VERSION}`;
const ASSET_CACHE = `typikon-assets-${VERSION}`;
const PAGE_CACHE = `typikon-pages-${VERSION}`;
// Без версии в имени: отложенное человеком не должно пропадать оттого, что мы
// поправили правила кэширования. Из очистки при активации оно исключено явно.
const SAVED_CACHE = "typikon-saved";

const OFFLINE_URL = "/offline";
// Опись отложенного. Синтетический ключ внутри SAVED_CACHE: по сети за ним никто
// не ходит, а лежать он должен там же, где и сами страницы, — тогда «убрать всё»
// это одно удаление кэша, и рассинхронизации описи с содержимым не бывает.
const INDEX_URL = "/__offline-index";

// Сколько прочитанных страниц держим в офлайне. Медианное чтение — около 2 КБ текста,
// так что даже сотня страниц занимает немного, но расти без предела кэшу незачем.
const PAGE_LIMIT = 100;

// Разделы, чей HTML собирается на сервере из данных вошедшего человека: имя,
// заметки, ключи API, очередь набора. Признак здесь не «закрыто от поисковика»
// (тот список шире, см. robots.ts), а «в ответе лежит личное». Такое незачем
// хранить на диске: показано оно будет только в офлайне, а пережить выход из
// учётной записи и общий компьютер — переживёт.
const PRIVATE = /^\/(api|admin|profile|texting|login)(\/|$)/;

// ignoreVary везде, где ищем по кэшам: отложенное кладёт сам воркер обычным
// fetch, а спрашивает браузер навигацией — заголовки запросов разные, и без
// этого флага сохранённая страница в офлайне не нашлась бы.
const MATCH = { ignoreVary: true };

// Запасную страницу мало положить в кэш: без своих стилей и скриптов она в офлайне
// откроется голой, а имена чанков содержат хэш сборки и заранее не известны. Поэтому
// при установке достаём их из её же разметки.
const precacheShell = async () => {
    const shell = await caches.open(SHELL_CACHE);
    const response = await fetch(OFFLINE_URL, { cache: "reload" });
    if (!response.ok) throw new Error(`запасная страница ответила ${response.status}`);

    const html = await response.clone().text();
    await shell.put(OFFLINE_URL, response);

    const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
    const cache = await caches.open(ASSET_CACHE);
    await Promise.all([...assets].map(async (asset) => {
        try {
            if (await cache.match(asset, MATCH)) return;
            const assetResponse = await fetch(asset);
            if (assetResponse.ok) await cache.put(asset, assetResponse);
        } catch (e) {
            // не далась одна подкладка — установку из-за неё не срываем
        }
    }));
};

self.addEventListener("install", (event) => {
    event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
    const keep = new Set([SHELL_CACHE, ASSET_CACHE, PAGE_CACHE, SAVED_CACHE]);
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter((name) => name.startsWith("typikon-") && !keep.has(name))
                    .map((name) => caches.delete(name)),
            ))
            .then(() => self.clients.claim()),
    );
});

const trimCache = async (cacheName, limit) => {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= limit) return;
    // Ключи идут в порядке добавления — удаляем самые давние.
    await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
};

const readIndex = async () => {
    const cache = await caches.open(SAVED_CACHE);
    const response = await cache.match(INDEX_URL, MATCH);
    if (!response) return [];
    try {
        const entries = await response.json();
        return Array.isArray(entries) ? entries : [];
    } catch (e) {
        return [];
    }
};

const writeIndex = async (entries) => {
    const cache = await caches.open(SAVED_CACHE);
    await cache.put(INDEX_URL, new Response(JSON.stringify(entries), {
        headers: { "Content-Type": "application/json" },
    }));
};

const cacheFirst = async (request, cacheName) => {
    const cached = await caches.match(request, MATCH);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
    }
    return response;
};

const networkFirst = async (request) => {
    try {
        const response = await fetch(request);
        if (response.ok) {
            // Отложенную страницу обновляем на месте, а не заводим ей второй
            // экземпляр в кэше страниц: иначе сохранённое старело бы ровно
            // потому, что его продолжают читать.
            const saved = await caches.open(SAVED_CACHE);
            if (await saved.match(request, MATCH)) {
                await saved.put(request, response.clone());
            } else {
                const cache = await caches.open(PAGE_CACHE);
                await cache.put(request, response.clone());
                trimCache(PAGE_CACHE, PAGE_LIMIT);
            }
        }
        return response;
    } catch (e) {
        const cached = await caches.match(request, MATCH);
        if (cached) return cached;

        // Раньше здесь отдавалась разметка запасной страницы прямо под запрошенным
        // адресом — и роутер Next, увидев, что дерево маршрута в HTML не про этот
        // адрес, шёл за данными в сеть, которой нет, и валился в «Что-то сломалось».
        // Поэтому не подменяем ответ, а переводим на собственный адрес страницы:
        // там разметка и адрес сходятся. Зацикливания нет — запрос самого /offline
        // до сюда не доходит, его отдаёт caches.match выше.
        if (await caches.match(OFFLINE_URL, MATCH)) {
            return Response.redirect(new URL(OFFLINE_URL, self.location.origin).href, 302);
        }

        throw e;
    }
};

self.addEventListener("fetch", (event) => {
    const { request } = event;

    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (PRIVATE.test(url.pathname)) return;

    if (url.pathname.startsWith("/_next/static/")) {
        event.respondWith(cacheFirst(request, ASSET_CACHE));
        return;
    }

    if (/^\/(fonts|icons|images)\//.test(url.pathname)) {
        event.respondWith(cacheFirst(request, ASSET_CACHE));
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
    }
});

// --- Отложенное чтение -------------------------------------------------------
//
// Страница просит воркер сохранить себя и присылает список своих подкладок —
// стили, скрипты, шрифты. Без них сохранённый HTML в офлайне открылся бы голым:
// имена чанков содержат хэш сборки, и после следующей выкладки прежних в общем
// кэше уже нет.

const savePage = async (url, label, assets) => {
    const request = new Request(url, { credentials: "same-origin" });
    const response = await fetch(request, { cache: "reload" });
    if (!response.ok) throw new Error(`страница ответила ${response.status}`);

    const cache = await caches.open(SAVED_CACHE);
    const measured = response.clone();
    await cache.put(request, response);

    let bytes = (await measured.blob()).size;

    // Подкладки кладём поштучно и молча пропускаем то, что не далось: страница
    // без одной картинки читается, а вот отказ из-за неё был бы непонятен.
    await Promise.all((assets || []).map(async (asset) => {
        try {
            const assetUrl = new URL(asset, self.location.origin);
            if (assetUrl.origin !== self.location.origin) return;
            if (await cache.match(assetUrl.href, MATCH)) return;

            const assetResponse = await fetch(assetUrl.href, { credentials: "same-origin" });
            if (!assetResponse.ok) return;

            const assetCopy = assetResponse.clone();
            await cache.put(assetUrl.href, assetResponse);
            bytes += (await assetCopy.blob()).size;
        } catch (e) {
            // не даётся — и не надо
        }
    }));

    const entries = (await readIndex()).filter((entry) => entry.url !== url);
    entries.push({ url, label, savedAt: Date.now(), bytes });
    await writeIndex(entries);

    return entries;
};

const forgetPage = async (url) => {
    const cache = await caches.open(SAVED_CACHE);
    await cache.delete(url);
    // Подкладки не трогаем: они общие для всех сохранённых страниц, и удаление
    // вместе с одной страницей разуло бы остальные. Целиком их убирает «убрать всё».
    const entries = (await readIndex()).filter((entry) => entry.url !== url);
    await writeIndex(entries);
    return entries;
};

const clearSaved = async () => {
    await caches.delete(SAVED_CACHE);
    return [];
};

// Занятое место считаем по факту, а не по описи: в описи только страницы, а
// половину объёма делают общие подкладки.
const savedBytes = async () => {
    const cache = await caches.open(SAVED_CACHE);
    const keys = await cache.keys();
    let total = 0;
    for (const key of keys) {
        const response = await cache.match(key, MATCH);
        if (!response) continue;
        total += (await response.blob()).size;
    }
    return total;
};

self.addEventListener("message", (event) => {
    const data = event.data || {};
    if (typeof data.type !== "string" || !data.type.startsWith("offline:")) return;

    const port = event.ports && event.ports[0];
    const answer = (payload) => port && port.postMessage(payload);

    const run = async () => {
        switch (data.type) {
            case "offline:list":
                return { saved: await readIndex() };
            case "offline:save":
                return { saved: await savePage(data.url, data.label, data.assets) };
            case "offline:forget":
                return { saved: await forgetPage(data.url) };
            case "offline:clear":
                return { saved: await clearSaved() };
            case "offline:usage":
                return { saved: await readIndex(), bytes: await savedBytes() };
            default:
                throw new Error(`неизвестная просьба ${data.type}`);
        }
    };

    event.waitUntil(
        run().then(
            (payload) => answer({ ok: true, ...payload }),
            (error) => answer({ ok: false, error: String(error && error.message || error) }),
        ),
    );
});
