// Учёт клиентов первой версии API и разметка её как устаревшей.
//
// План перевода такой: v2 объявлена публичной, сайт на неё уже переведён, дальше
// приложение начинает представляться заголовком X-Typikon-App, и только когда доля
// старых клиентов станет мала — v1 закрывается для всех прочих.
//
// Ключевое здесь — «когда станет мала»: закрывать v1 вслепую нельзя, потому что уже
// установленные версии приложения заголовка не шлют и отвалятся все разом. Поэтому
// сначала считаем.
//
// Счётчики живут в памяти процесса и раз в несколько минут выводятся строкой в лог:
// journalctl -u typikon-web | grep typikon-v1-usage

export const APP_HEADER = "x-typikon-app";

// Дата, после которой предполагается закрыть v1 для клиентов без заголовка.
// Ориентир для потребителей, а не выключатель: смотреть надо на цифры из лога.
export const SUNSET = "Wed, 01 Jul 2026 00:00:00 GMT";

const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

interface Tally {
    withApp: number;
    withoutApp: number;
    versions: Map<string, number>;
    since: number;
}

const empty = (): Tally => ({ withApp: 0, withoutApp: 0, versions: new Map(), since: Date.now() });

let tally = empty();

/**
 * Выводит накопленное и обнуляет счётчик. Экспортируется ради тестов и на случай,
 * если понадобится снять срез немедленно.
 */
export const flushUsage = () => {
    const total = tally.withApp + tally.withoutApp;
    if (!total) {
        tally = empty();
        return;
    }

    console.log(JSON.stringify({
        tag: "typikon-v1-usage",
        at: new Date().toISOString(),
        windowMinutes: Math.round((Date.now() - tally.since) / 60000),
        total,
        withApp: tally.withApp,
        withoutApp: tally.withoutApp,
        // Доля клиентов, которых закрытие v1 сломает прямо сейчас.
        withoutAppShare: Math.round((tally.withoutApp / total) * 100) / 100,
        versions: Object.fromEntries(tally.versions),
    }));

    tally = empty();
};

/** Сбрасывает накопленное без вывода — нужно тестам, чтобы не влиять друг на друга. */
export const resetUsage = () => {
    tally = empty();
};

/** Считает один запрос к v1 и возвращает версию приложения, если она представилась. */
export const countV1Request = (headers: Headers): string | null => {
    const version = headers.get(APP_HEADER);

    if (version) {
        tally.withApp++;
        const key = version.slice(0, 20);
        tally.versions.set(key, (tally.versions.get(key) ?? 0) + 1);
    } else {
        tally.withoutApp++;
    }

    if (Date.now() - tally.since >= FLUSH_INTERVAL_MS) flushUsage();

    return version;
};

/** Стандартные заголовки устаревания — понятны и человеку, и клиентским библиотекам. */
export const deprecationHeaders = (): Record<string, string> => ({
    "Deprecation": "true",
    "Sunset": SUNSET,
    "Link": '</api/v2>; rel="successor-version", <https://typikon.su/api>; rel="help"',
});
