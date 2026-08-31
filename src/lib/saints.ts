// Каталог святых для страниц сайта.
//
// До переезда страница /saints/{id} держалась на чужом номере: адрес был
// идентификатором памяти в святцах dneslov.org, а имя тянулось к ним по сети на
// каждый показ. Теперь адрес наш (`saints.slug`), запись наша, а номер святцев —
// один из внешних ключей (см. @/lib/saintSources).
//
// Старые адреса не выброшены: /saints/3030 продолжает работать и уводит постоянным
// редиректом на новый. Иначе рассыпались бы ссылки, стоящие в разметке самих текстов
// корпуса, — их там сотни, и переписывать их означало бы править сам корпус.
import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { SAINT_SOURCES, byExternal, type SaintExternal } from "@/lib/saintSources";

const DNESLOV = SAINT_SOURCES.dneslov.code;

export interface Saint {
    _id: any;
    slug: string | null;
    /** Адреса, под которыми запись жила раньше. С них уводит постоянный редирект. */
    previousSlugs?: string[];
    /** Основное именование — наше. Из снимка по умолчанию, руками — через set-saint-name.ts. */
    name: string | null;
    /** Прочие известные именования: варианты, прозвания, мирские имена. */
    altNames: string[];
    title: string | null;
    type: string | null;
    orders: string[];
    councils: string[];
    baseYear: number | null;
    memoryDates: string[];
    imageUrl: string | null;
    roundelUrl: string | null;
    /** Ссылки на изображения у святцев. Файлы не наши и лежат на их CDN. */
    images: SaintImage[];
    externals: SaintExternal[];
}

export interface SaintImage {
    url: string;
    thumbUrl: string | null;
    type?: string | null;
    title?: string | null;
}

const collection = async () => (await clientPromise).db("typikon").collection("saints");

/** Номера святцев, стоящие за записью. Их может быть несколько: две памяти, сведённые нами в одно лицо. */
export const dneslovIdsOf = (saint: Saint | null): string[] =>
    (saint?.externals ?? []).filter((e) => e.source === DNESLOV).map((e) => String(e.id));

/**
 * Запись по адресу из строки запроса. Адрес — либо наш слуг, либо, для старых
 * ссылок, номер памяти в святцах. Что именно пришло, вызывающий выясняет сам,
 * сравнив `slug` с тем, что было в адресе, — и уводит редиректом, если это номер.
 */
export const getSaintByAddress = cached(async (address: string): Promise<Saint | null> => {
    if (!address) return null;
    const saints = await collection();

    const bySlug = await saints.findOne({ slug: address });
    if (bySlug) return bySlug as unknown as Saint;

    // Прежний адрес записи: слуг однажды сменили руками (см. set-saint-slug.ts).
    // Находим запись, а уводит с него тот же постоянный редирект, что и с номера.
    const byOldSlug = await saints.findOne({ previousSlugs: address });
    if (byOldSlug) return byOldSlug as unknown as Saint;

    // Номером ищем только то, что похоже на номер: слуг из одних цифр мы не выдаём,
    // а лишний запрос на каждую опечатку в адресе ни к чему.
    if (!/^\d+$/.test(address)) return null;
    return (await saints.findOne(byExternal(DNESLOV, address))) as unknown as Saint | null;
}, ["saint-by-address"], [CacheTag.SAINTS]);

/**
 * Общий разбор выборки «пачка номеров святцев -> поле каталога». Ключей одного
 * источника у записи может быть несколько, поэтому ответ раскладывается по всем
 * запрошенным номерам, а не по записям.
 */
const byDneslovIds = async <T,>(
    ids: string[],
    projection: Record<string, 1>,
    pick: (saint: any) => T | null,
): Promise<Record<string, T>> => {
    const unique = [...new Set(ids.filter(Boolean).map(String))];
    if (!unique.length) return {};

    const saints = await collection();
    const rows = await saints
        .find({ externals: { $elemMatch: { source: DNESLOV, id: { $in: unique } } } },
            { projection: { ...projection, externals: 1 } })
        .toArray();

    const result: Record<string, T> = {};
    rows.forEach((saint: any) => {
        const value = pick(saint);
        if (value === null || value === undefined) return;
        (saint.externals ?? [])
            .filter((e: any) => e.source === DNESLOV && unique.includes(String(e.id)))
            .forEach((e: any) => { result[String(e.id)] = value; });
    });
    return result;
};

/** Имена показанных памятей — из нашей базы, без похода в святцы. */
export const saintNames = (ids: string[]) =>
    byDneslovIds<string>(ids, { name: 1 }, (s) => s.name ?? null);

/** Адреса показанных памятей: чтобы ссылки со страниц вели сразу на слуг, а не через редирект. */
export const saintSlugs = (ids: string[]) =>
    byDneslovIds<string>(ids, { slug: 1 }, (s) => s.slug ?? null);

/**
 * Всё, что нужно указателю: имя, адрес и альтернативные имена (по ним тоже ищут).
 * Одним запросом вместо трёх — указатель просит их для всех восьмисот памятей сразу.
 */
export const saintCards = (ids: string[]) =>
    byDneslovIds<{ name: string | null; slug: string | null; altNames: string[] }>(
        ids,
        { name: 1, slug: 1, altNames: 1 },
        (s) => ({ name: s.name ?? null, slug: s.slug ?? null, altNames: s.altNames ?? [] }),
    );

/** Кругляши для списков: раньше их тянул из браузера каждый ряд списка отдельным запросом. */
export const saintRoundels = (ids: string[]) =>
    byDneslovIds<string>(ids, { roundelUrl: 1 }, (s) => s.roundelUrl ?? null);

/**
 * Ссылки на изображения памяти. null — памяти нет в каталоге (тогда вызывающий волен
 * сходить в святцы сам), пустой список — «картинок нет», и это тоже ответ.
 */
export const saintImages = async (dneslovId: string): Promise<SaintImage[] | null> => {
    if (!dneslovId) return null;
    const saints = await collection();
    const saint: any = await saints.findOne(byExternal(DNESLOV, String(dneslovId)), { projection: { images: 1 } });
    if (!saint) return null;
    return Array.isArray(saint.images) ? saint.images : [];
};

/**
 * Снимок памяти из святцев — то, что раньше запрашивалось у dneslov.org на каждый
 * показ. Форма ответа та же самая (их `{slug}.json`), поэтому разметка страницы
 * не изменилась; изменилось то, что она больше не ждёт чужой сервер.
 */
export const snapshotOfMemory = cached(async (dneslovId: string): Promise<any | null> => {
    if (!dneslovId) return null;
    const db = (await clientPromise).db("typikon");
    const doc: any = await db.collection("dneslov_memories").findOne({ _id: dneslovId as any });
    if (!doc?.details) return null;
    // slug у них живёт в первом ответе, а не в подробностях — снимок хранит его наверху.
    return { ...doc.details, slug: doc.slug ?? doc.details?.slug ?? null };
}, ["saint-memory-snapshot"], [CacheTag.SAINTS]);
