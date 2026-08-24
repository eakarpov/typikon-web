// Service worker: офлайн-чтение и быстрый повторный заход.
//
// Правила выбраны так, чтобы не воспроизвести классическую поломку PWA, когда после
// выкладки нового билда закэшированный HTML тянет уже удалённые чанки и страница белеет:
//   * навигации (HTML) — сначала сеть, кэш только как запасной вариант в офлайне;
//   * /_next/static — можно смело из кэша: имена файлов содержат хэш содержимого,
//     при новой сборке имена другие;
//   * шрифты и картинки — из кэша, они большие и не меняются (только шрифтов 1,2 МБ);
//   * /api и /admin не кэшируются вовсе: первое отдаёт данные пользователя,
//     второе должно быть только свежим.
//
// Версию поднимать при изменении правил: старые кэши удаляются при активации.
const VERSION = "v1";
const SHELL_CACHE = `typikon-shell-${VERSION}`;
const ASSET_CACHE = `typikon-assets-${VERSION}`;
const PAGE_CACHE = `typikon-pages-${VERSION}`;

const OFFLINE_URL = "/offline";
// Сколько прочитанных страниц держим в офлайне. Медианное чтение — около 2 КБ текста,
// так что даже сотня страниц занимает немного, но расти без предела кэшу незачем.
const PAGE_LIMIT = 100;

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.add(OFFLINE_URL))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter((name) => name.startsWith("typikon-") && !name.endsWith(VERSION))
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

const cacheFirst = async (request, cacheName) => {
    const cached = await caches.match(request);
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
            const cache = await caches.open(PAGE_CACHE);
            await cache.put(request, response.clone());
            trimCache(PAGE_CACHE, PAGE_LIMIT);
        }
        return response;
    } catch (e) {
        const cached = await caches.match(request);
        if (cached) return cached;

        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;

        throw e;
    }
};

self.addEventListener("fetch", (event) => {
    const { request } = event;

    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;

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
