// Имена и карточки Днеслова: долговечный снимок в Mongo + быстрый кэш Next.
// Ошибка источника не удаляет полученные раньше данные и не кэшируется как пустота.
import { cached, CacheTag } from "@/lib/cache";
import { durableDneslovTitle } from "@/lib/dneslovDay";
import {reportError} from "@/lib/reportError";

// Сутки: имя святого в святцах не меняется годами, а мы платим за каждый промах
// походом наружу. Тег SAINTS оставлен на случай, если понадобится сбросить руками.
const TITLE_REVALIDATE = 86400;

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

export const saintFallbackTitle = (id: string) => `Память №${id}`;

// Внутрь кэша уходит только успех: если бросить исключение, unstable_cache ничего
// не запомнит. Иначе одна минута недоступности dneslov.org застряла бы на сутки.
const loadTitle = cached(async (id: string) => {
    const title = await durableDneslovTitle(id);
    if (!title) throw new Error(`dneslov: у памяти ${id} нет названия`);
    return title;
}, ["dneslov-saint-title:v3"], [CacheTag.SAINTS], TITLE_REVALIDATE);

// Имя одной памяти. null — "сейчас не знаем", а не "такой памяти нет":
// решение, что показать вместо имени, принимает вызывающий.
export const saintTitle = async (id: string): Promise<string | null> => {
    if (!id) return null;
    try {
        return await loadTitle(id);
    } catch (e) {
        reportError(e, { where: "lib/dneslov: не удалось получить имя памяти", extra: { id } });
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

// Полные ответы сохраняются в Mongo, а не только в кэше процесса Next.
export { durableDneslovMemory as saintMemory } from "@/lib/dneslovDay";
