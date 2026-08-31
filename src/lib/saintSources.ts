// Внешние источники, с которыми сводится каталог святых (`saints.externals`).
//
// ПОЧЕМУ СПИСОК, А НЕ КАРТА. По смыслу externals — это и есть отображение
// «источник → ключ», и просилась карта. Но карта не выражает случая, ради
// которого каталог и заводился: у одной нашей записи может быть ДВА ключа
// ОДНОГО источника. Это не курьёз, а основная работа отождествления — святцы
// сплошь и рядом держат одно лицо двумя памятями (мирское имя и церковное,
// само лицо и перенесение мощей), и решение «это один человек» принимаем мы,
// а хранить его больше негде. Карта такое решение записать не даёт.
//
// Вдобавок Mongo индексирует список подобъектов одним составным ключом
// (externals.source + externals.id, см. ensure-indexes.ts), а карту с
// произвольными ключами пришлось бы индексировать по индексу на источник —
// то есть править индексы при каждом новом источнике.
//
// ВАЖНО при поиске: пару «источник + ключ» ищут только через $elemMatch. Запрос
// { "externals.source": a, "externals.id": b } без него совпадает и тогда, когда
// a пришёл из одного элемента списка, а b из другого. Для этого есть byExternal().
export interface SaintSource {
    code: string;
    /** Как называем источник человеку. */
    title: string;
    /** Страница записи у них — для ссылки «смотреть у источника». null, если по ключу её не собрать. */
    url: (id: string, slug?: string | null) => string | null;
    /** Откуда ключи этого источника берутся у нас. */
    origin: string;
}

export const SAINT_SOURCES: Record<string, SaintSource> = {
    // Святцы dneslov.org. Страница памяти у них живёт по слугу, а не по номеру
    // (номер — только у JSON: /api/v0/memories/{id}.json), поэтому без слуга
    // ссылку не собрать.
    dneslov: {
        code: "dneslov",
        title: "Днеслов",
        url: (_id, slug) => (slug ? `https://dneslov.org/${slug}` : null),
        origin: "снимок святцев, src/scripts/sync-dneslov.ts",
    },
    // Викиданные. Ключи уже есть в родословной (nobles.wikidataId), отдельного
    // импорта в каталог пока нет — источник заведён, чтобы связи было куда класть.
    wikidata: {
        code: "wikidata",
        title: "Викиданные",
        url: (id) => `https://www.wikidata.org/wiki/${id}`,
        origin: "родословная, nobles.wikidataId (src/scripts/import-nobles-wikidata.ts)",
    },
};

export interface SaintExternal {
    source: string;
    id: string;
    slug?: string | null;
    /** Когда сведения по этому ключу последний раз подтверждались у источника. */
    syncedAt?: Date | null;
    /** "ok" — ключ жив; "gone" — у источника такой записи больше нет, нужно решение человека. */
    status?: "ok" | "gone";
    goneAt?: Date | null;
    /** Чем ключ обоснован, если решение принимал человек (слияние, спорное отождествление). */
    note?: string | null;
}

export const sourceTitle = (code: string) => SAINT_SOURCES[code]?.title ?? code;

export const externalUrl = (external: SaintExternal): string | null =>
    SAINT_SOURCES[external.source]?.url(external.id, external.slug) ?? null;

/** Условие поиска записи по паре «источник + ключ». Только так — см. шапку. */
export const byExternal = (source: string, id: string) => ({
    externals: { $elemMatch: { source, id: String(id) } },
});
