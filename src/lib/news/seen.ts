// Отметки о прочтении новостей. Ключи и правила чтения хранилища — в одном месте,
// потому что писать их и читать берутся разные компоненты (лента и меню).

export const NEWS_SEEN_KEY = "news-seen-at";
/** Последняя новость, о которой мы знаем: чтобы не спрашивать сервер на каждой странице. */
export const NEWS_LATEST_KEY = "news-latest-at";
export const NEWS_CHECKED_KEY = "news-checked-at";
export const NEWS_SEEN_EVENT = "typikon:news-seen";

/** Спрашиваем сервер не чаще раза в полчаса: новости выходят реже, чем открываются страницы. */
export const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export const readStorage = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

export const writeStorage = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Приватный режим — обойдёмся без отметок.
    }
};
