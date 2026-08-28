// Имена святых для страниц сайта. Своей идентичности святых в проекте нет — она
// целиком живёт в святцах dneslov.org, и по LICENSE-CORPUS.md эти сведения "приходят
// по их API при показе страницы, в корпусе не хранятся". Поэтому здесь нет и не должно
// появиться таблицы имён в Mongo: только HTTP-кэш с суточным сроком жизни, как у CDN.
//
// Модуль решает три задачи, которых не решал прямой fetch в src/app/saints/[id]/api.ts:
//   1. кэш — раньше каждый заход на страницу святого стоил двух последовательных
//      запросов наружу (~0.5 с каждый, а однажды при замере соединение висело 75 с);
//   2. таймаут — внешний сервис больше не может подвесить рендер нашей страницы;
//   3. деградация — если dneslov.org молчит, страница остаётся живой: тексты-то наши,
//      вместо имени показываем "Память №3030", ссылка работает по-прежнему.
//
// Не путать с src/scripts/lib/dneslov.ts: тот — для скриптов (undici, обход TLS,
// подробные логи в консоль), этот — для рендера страниц.
import { cached, CacheTag } from "@/lib/cache";

// Сутки: имя святого в святцах не меняется годами, а мы платим за каждый промах
// походом наружу. Тег SAINTS оставлен на случай, если понадобится сбросить руками.
const TITLE_REVALIDATE = 86400;

// Внешний сервис не должен держать наш рендер: лучше показать "Память №N",
// чем заставить читателя ждать. Замер 2026-08-27: удачный ответ — 0.5 с.
const TIMEOUT_MS = 3000;

// Столько имён тянем одновременно. Страница чтения просит две-три штуки, индекс
// святых — полсотни; без ограничения полсотни параллельных запросов к чужому
// сервису — это уже неприлично.
const CONCURRENCY = 8;

// Потолок на всю пачку имён. Без него страница указателя ждала бы худшего случая
// по каждой из полусотни памятей: замер 2026-08-27 дал 39 секунд на страницу, когда
// святцы отвечали через раз. Что не успело приехать — показывается как "Память №N",
// а начатые запросы всё равно доедут и лягут в кэш, так что при следующем заходе
// имена уже на месте. Лучше быстрая страница, которая дозаполняется, чем честная,
// которую никто не дождётся.
const BATCH_BUDGET_MS = 2500;

// Пути без схемы: какая из них доедет — выясняем на месте. В src/scripts/lib/dneslov.ts
// записано, что эти два эндпоинта отвечают только по http; замер 2026-08-27 показал
// обратное — по http соединение не устанавливается вовсе, по https отвечает через раз.
// Значит, дело не в схеме, а в нестабильности самого сервиса, и полагаться на одну
// из двух нельзя: пробуем https, затем http.
const MEMORY_PATH = (id: string) => `dneslov.org/api/v0/memories/${id}.json`;
const DETAILS_PATH = (slug: string) => `dneslov.org/${slug}.json`;

const SCHEMES = ["https", "http"];

export const saintFallbackTitle = (id: string) => `Память №${id}`;

// memories/{id}.json — самый дешёвый ответ у dneslov: title и short_name
// без событий, ссылок и описаний.
const fetchJson = async (path: string) => {
    let last: unknown = null;

    for (const scheme of SCHEMES) {
        try {
            const res = await fetch(`${scheme}://${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
            if (!res.ok) throw new Error(`ответил ${res.status}`);
            return await res.json();
        } catch (e) {
            last = e;
        }
    }

    throw new Error(`dneslov: ${path} недоступен (${last instanceof Error ? last.message : last})`);
};

// Внутрь кэша уходит только успех: если бросить исключение, unstable_cache ничего
// не запомнит. Иначе одна минута недоступности dneslov.org застряла бы на сутки.
const loadTitle = cached(async (id: string) => {
    const memory = await fetchJson(MEMORY_PATH(id));
    const title = memory?.title || memory?.short_name;
    if (!title) throw new Error(`dneslov: у памяти ${id} нет названия`);
    return String(title);
}, ["dneslov-saint-title"], [CacheTag.SAINTS], TITLE_REVALIDATE);

// Имя одной памяти. null — "сейчас не знаем", а не "такой памяти нет":
// решение, что показать вместо имени, принимает вызывающий.
export const saintTitle = async (id: string): Promise<string | null> => {
    if (!id) return null;
    try {
        return await loadTitle(id);
    } catch (e) {
        console.error(`dneslov: не удалось получить имя памяти ${id}`, e);
        return null;
    }
};

// Имена пачкой. Всегда возвращает запись для каждого запрошенного id —
// с настоящим именем или с заглушкой, чтобы вызывающему не приходилось
// разбирать пропуски прямо в разметке.
export const saintTitles = async (
    ids: string[],
    budgetMs: number = BATCH_BUDGET_MS,
): Promise<Record<string, string>> => {
    const unique = [...new Set(ids.filter(Boolean))];
    const result: Record<string, string> = {};
    unique.forEach((id) => { result[id] = saintFallbackTitle(id); });

    const deadline = Date.now() + budgetMs;

    for (let i = 0; i < unique.length; i += CONCURRENCY) {
        const left = deadline - Date.now();

        if (left <= 0) {
            // Бюджет вышел — остальное дозапрашиваем вдогонку, уже не задерживая ответ.
            // Что доедет, ляжет в кэш и появится на странице при следующем заходе;
            // сейчас там будут заглушки. Столько же запросов, но читатель их не ждёт.
            warmInBackground(unique.slice(i));
            break;
        }

        const chunk = unique.slice(i, i + CONCURRENCY);
        const pending = chunk.map((id) => saintTitle(id).catch(() => null));

        const titles = await Promise.race([
            Promise.all(pending),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), left)),
        ]);

        // Начатую пачку не бросаем совсем: она дорешается сама и наполнит кэш.
        if (!titles) {
            warmInBackground(unique.slice(i + CONCURRENCY));
            break;
        }

        chunk.forEach((id, index) => {
            if (titles[index]) result[id] = titles[index] as string;
        });
    }

    return result;
};

// Догрузка имён после ответа страницы. По очереди, а не разом: смысл здесь не в
// скорости, а в том, чтобы кэш наполнился, не заваливая чужой сервис пачкой запросов.
//
// Неудачи мы намеренно не кэшируем, поэтому каждый заход на страницу начинал бы
// догрузку тех же имён заново; при нескольких читателях подряд это выросло бы в
// стопку одинаковых запросов к чужому серверу. Отмечаем взятое в работу и не берём
// дважды — пометка снимается, как только имя доехало или окончательно не далось.
const warming = new Set<string>();

const warmInBackground = (ids: string[]) => {
    const todo = ids.filter((id) => !warming.has(id));
    if (!todo.length) return;

    todo.forEach((id) => warming.add(id));

    void (async () => {
        for (const id of todo) {
            await saintTitle(id).catch(() => null);
            warming.delete(id);
        }
    })();
};

const loadMemory = cached(async (id: string) => {
    const memory = await fetchJson(MEMORY_PATH(id));
    if (!memory?.slug) throw new Error(`dneslov: у памяти ${id} нет slug`);

    const details = await fetchJson(DETAILS_PATH(memory.slug));
    // slug берём из первого ответа: во втором его может не быть.
    return { ...details, slug: memory.slug };
}, ["dneslov-saint-memory"], [CacheTag.SAINTS], TITLE_REVALIDATE);

// Полная карточка памяти для /saints/[id]: житие, ссылки, чин. null означает,
// что dneslov.org недоступен, — страницу это больше не отменяет.
export const saintMemory = async (id: string): Promise<any | null> => {
    if (!id) return null;
    try {
        return await loadMemory(id);
    } catch (e) {
        console.error(`dneslov: не удалось получить память ${id}`, e);
        return null;
    }
};
