// Храмы и их престолы: выборка для указателя, карточки и карты.
//
// ПОЧЕМУ ПРЕСТОЛ, А НЕ «ПОСВЯЩЕНИЕ ХРАМА». «Храм» уставных книг — это
// ПРЕСТОЛ, у которого служат, а не здание: в храме с приделами их несколько,
// и «свята́го, его́же есть храм» сегодня один, а завтра другой. Отсюда
// множественное число во всех полях и отдельный выбор престола на карточке.
//
// ДАТЫ ПРЕСТОЛЬНЫХ ПРАЗДНИКОВ СЧИТАЕМ ЗДЕСЬ, а не спрашиваем у службы устава:
// это простая арифметика (месяцеслов плюс тринадцать дней, подвижные — от
// Пасхи), и ради неё поднимать отдельную службу незачем. Сборка последования —
// другое дело, за ней ходят к ней.

import { orthodoxEaster } from "date-easter";
import clientPromise from "@/lib/mongodb";

export interface TempleFeast {
    month?: number;
    day?: number;
    paschaOffset?: number;
    note?: string;
    memoryId?: string | null;
    memoryLabel?: string | null;
    sign?: string | null;
}

export interface TemplePrestol {
    dedication: string;
    label: string;
    isMain: boolean;
    /**
     * Существует престол или утрачен.
     *
     * Утраченный — не пустая запись: престол, освящённый на этом месте и потом
     * упразднённый, приход нередко продолжает праздновать, и память его
     * остаётся памятью ХРАМА. Ставится только руками: из названия и открытых
     * данных этого не выведешь.
     */
    state?: "current" | "lost";
    /** gospodskiy | bogorodichen | svyatogo — от вида зависит ряд тропарей по входе. */
    kind: string;
    memoryIds: string[];
    source: string;
    tier?: string;
    confidence?: number;
    status: string;
}

export interface Temple {
    slug: string;
    name: string;
    kind: string;
    place: string | null;
    year: number | null;
    latitude: number;
    longitude: number;
    prestoly: TemplePrestol[];
    /** Двухбуквенный код страны, как он размечен в источнике. */
    country?: string | null;
    /** Поместная Церковь (ключ @/utils/jurisdictions). */
    church?: string | null;
    /** «denomination» — сказано источником, «country» — выведено по стране. */
    churchSource?: "denomination" | "country" | null;
    /** Устав движка (rite/tradition) или null, когда его у нас нет. */
    ustav?: string | null;
    wikidataId?: string;
    osmId?: string;
    source?: string;
    sourceUrl?: string;
}

export const TEMPLES_PER_PAGE = 40;

export const KIND_LABELS: Record<string, string> = {
    church: "церковь",
    cathedral: "собор",
    chapel: "часовня",
    monastery: "монастырь",
    "not-temple": "постройка",
};

/**
 * Гражданская дата престольного праздника в этом году.
 *
 * Неподвижная память напечатана в Минее по СТАРОМУ стилю, и к ней прибавляются
 * те же тринадцать дней, на которые церковная дата отстаёт в @/lib/calcDay.
 * Подвижная считается от Пасхи — и потому у Троицкого храма престольный
 * праздник каждый год в разный день; этого не показывает ни один календарь,
 * потому что списка престолов ни у кого нет.
 */
export const feastDate = (feast: TempleFeast, year: number): Date | null => {
    if (feast.paschaOffset !== undefined) {
        const e = orthodoxEaster(year);
        const pascha = new Date(Date.UTC(e.year, e.month - 1, e.day));
        pascha.setUTCDate(pascha.getUTCDate() + feast.paschaOffset);
        return pascha;
    }
    if (feast.month === undefined || feast.day === undefined) return null;
    const d = new Date(Date.UTC(year, feast.month - 1, feast.day));
    d.setUTCDate(d.getUTCDate() + 13);
    return d;
};

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export const formatFeastDate = (date: Date): string =>
    `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;

const collection = async () => (await clientPromise).db("typikon").collection("temples");

export interface TempleQuery {
    query?: string;
    dedication?: string;
    kind?: string;
    page?: number;
}

/** Условие выборки. Общее у указателя и у карты, чтобы фильтр значил одно и то же. */
const filterOf = ({ query, dedication, kind }: TempleQuery) => {
    const where: Record<string, unknown> = { kind: { $ne: "not-temple" }, orthodox: { $ne: false } };
    if (dedication) where["prestoly.dedication"] = dedication;
    if (kind) where.kind = kind;
    if (query?.trim()) {
        // Ищем и по имени, и по месту: «Никольская» и «Суздаль» — одинаково
        // законные запросы, и разделять их отдельными полями значило бы
        // требовать от читателя знать, что он ищет.
        const rx = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        where.$or = [{ name: rx }, { place: rx }];
    }
    return where;
};

export const getTemples = async (q: TempleQuery): Promise<{ items: Temple[]; total: number }> => {
    const temples = await collection();
    const where = filterOf(q);
    const page = Math.max(1, q.page ?? 1);
    const [items, total] = await Promise.all([
        temples.find(where, { projection: { _id: 0 } })
            // Порядок устойчивый: сперва те, чей престол разобран увереннее.
            // По году сортировать нельзя: он известен у семи храмов из десяти,
            // и первую страницу заняли бы записи вовсе без года.
            .sort({ "prestoly.0.confidence": -1, name: 1 })
            .skip((page - 1) * TEMPLES_PER_PAGE).limit(TEMPLES_PER_PAGE).toArray(),
        temples.countDocuments(where),
    ]);
    return { items: items as unknown as Temple[], total };
};

export const getTemple = async (slug: string): Promise<Temple | null> => {
    const temples = await collection();
    return await temples.findOne({ slug }, { projection: { _id: 0 } }) as unknown as Temple | null;
};

export interface MapView {
    /** Видимая часть карты: запад, юг, восток, север. */
    bbox?: [number, number, number, number];
    zoom?: number;
}

/**
 * Сколько ЭКРАННЫХ ТОЧЕК отводим одной клетке сетки.
 *
 * Считать шаг сетки в градусах — ошибка, и видно её сразу: два градуса на
 * пятом приближении дают на экране двадцать точек, а кружок гнезда имеет сорок
 * в поперечнике, и карта превращается в кашу из налезающих друг на друга
 * кружков. Шаг обязан задаваться в том, в чём меряется налезание, — в
 * пикселях, а градусы из него выводятся по масштабу.
 */
const CELL_SPACING_PX = 78;

/** Ширина мира в точках на этом приближении — так устроены карты тайлов. */
const worldWidthPx = (zoom: number) => 256 * Math.pow(2, zoom);

const bboxFilter = (view: MapView) => {
    if (!view.bbox) return {};
    const [w, s, e, n] = view.bbox;
    // Через сто восьмидесятый меридиан рамка «переворачивается»: запад
    // оказывается больше востока. Тогда берём две половины, а не пустоту.
    const lon = w <= e ? { $gte: w, $lte: e } : { $not: { $gt: e, $lt: w } };
    return { longitude: lon, latitude: { $gte: s, $lte: n } };
};

export interface MapCell {
    x: number;
    y: number;
    n: number;
    /** Заполнены, когда храм в клетке один: тогда это не гнездо, а он сам. */
    s?: string;
    name?: string;
}

/**
 * Что рисовать на карте — сетка отвечает сразу и на любом приближении.
 *
 * ПОРОГА ПО МАСШТАБУ БОЛЬШЕ НЕТ, и это не упрощение, а исправление. Порог
 * («ближе девятого — показываем поодиночке») делит карту не по тому признаку:
 * решает не приближение, а ПЛОТНОСТЬ. На девятом шаге посреди Владимирской
 * области девять сотен храмов ложатся отдельными точками и слипаются в кашу, а
 * в пустыне и на третьем шаге показывать нечего, кроме одинокого храма.
 *
 * Поэтому клетка одна на все случаи — размером всегда в CELL_SPACING_PX на
 * экране, — а разбирается по её содержимому: один храм в клетке отдаётся сам
 * собою, с именем и адресом, несколько — числом. Приближение дробит клетки,
 * пока в каждой не останется по одному.
 *
 * Заодно это снимает и вопрос объёма: клеток на экране всегда полторы сотни,
 * сколько бы храмов ни лежало в базе.
 */
export const getTempleCells = async (q: TempleQuery, view: MapView): Promise<MapCell[]> => {
    const temples = await collection();
    const cell = Math.max(0.0002, (CELL_SPACING_PX * 360) / worldWidthPx(view.zoom ?? 3));

    const rows = await temples.aggregate([
        { $match: { ...filterOf(q), ...bboxFilter(view) } },
        {
            $group: {
                _id: {
                    x: { $floor: { $divide: ["$longitude", cell] } },
                    y: { $floor: { $divide: ["$latitude", cell] } },
                },
                n: { $sum: 1 },
                // Точка гнезда — средняя по храмам в нём, а не центр клетки:
                // иначе метки выстраиваются решёткой, и видно сетку, а не страну.
                x: { $avg: "$longitude" },
                y: { $avg: "$latitude" },
                slug: { $first: "$slug" },
                name: { $first: "$name" },
            },
        },
        {
            $project: {
                _id: 0, n: 1,
                x: { $round: ["$x", 5] },
                y: { $round: ["$y", 5] },
                // Имя и адрес — только у одиночек: у гнезда они принадлежали бы
                // случайному храму из многих и вели бы читателя не туда.
                s: { $cond: [{ $eq: ["$n", 1] }, "$slug", "$$REMOVE"] },
                name: { $cond: [{ $eq: ["$n", 1] }, "$name", "$$REMOVE"] },
            },
        },
    ]).toArray();

    return rows as MapCell[];
};

export interface DedicationDoc {
    slug: string;
    label: string;
    short: string;
    kind: string;
    /** Год прославления — черта на волне построек. */
    canonized?: number;
    feasts: TempleFeast[];
    saints: { dneslovId: string; name: string | null; slug: string | null }[];
    saintCandidates?: { dneslovId: string; name: string | null; slug: string | null }[];
}

export const getDedication = async (slug: string): Promise<DedicationDoc | null> =>
    (await clientPromise).db("typikon").collection("dedications")
        .findOne({ slug }, { projection: { _id: 0 } }) as unknown as Promise<DedicationDoc | null>;

/** Посвящения с числом храмов — для фильтра указателя и для карты. */
export const getDedicationCounts = async (): Promise<{ slug: string; short: string; count: number }[]> => {
    const temples = await collection();
    const rows = await temples.aggregate([
        { $match: { ...filterOf({}), "prestoly.0": { $exists: true } } },
        // Считаем храм при КАЖДОМ его престоле, а не только при главном.
        // Иначе счётчик в фильтре и сам фильтр говорят разное: отбор идёт по
        // любому престолу («prestoly.dedication»), и у храма с двумя престолами
        // второй в счёт не шёл, хотя по нему храм находился.
        { $unwind: "$prestoly" },
        { $group: { _id: "$prestoly.dedication", count: { $sum: 1 } } },
        { $match: { _id: { $ne: null } } },
        { $sort: { count: -1 } },
    ]).toArray();
    const dedications = await (await clientPromise).db("typikon").collection("dedications")
        .find({}, { projection: { slug: 1, short: 1 } }).toArray();
    const shortBy = new Map(dedications.map((d: any) => [d.slug, d.short]));
    return rows.map((r: any) => ({ slug: r._id, short: shortBy.get(r._id) ?? r._id, count: r.count }));
};

// ── География посвящений ─────────────────────────────────────────────────────
//
// Меры ареала и волны почитания. Считаются по каталогу и отвечают на вопросы,
// которых до сих пор никто не задавал числом: где кончается почитание местного
// святого, когда оно разошлось и что посвящение говорит о возрасте здания.

/** Ниже этого числа храмов выводов не делаем — показываем только карту. */
export const ENOUGH_FOR_STATS = 10;

export interface DedicationStats {
    /** Сколько храмов с этим престолом в каталоге. */
    count: number;
    /** Центр почитания: медиана широты и долготы, а не среднее. */
    center: { lat: number; lon: number } | null;
    /**
     * Радиус ареала в километрах: медианное удаление храма от центра и радиус,
     * вмещающий четыре пятых. Медиана, а не среднее: один храм в диаспоре
     * уводит среднее на тысячи вёрст, а медиану — никуда.
     */
    radiusMedianKm: number | null;
    radius80Km: number | null;
    /** Год постройки: медиана и границы половины (25% и 75%). */
    years: { median: number; q1: number; q3: number; known: number } | null;
    /** Гистограмма годов по полувекам — для картинки волны. */
    decades: { from: number; count: number }[];
    /** По странам, с превышением над общей долей страны в каталоге. */
    countries: { code: string; count: number; share: number; lift: number }[];
}

const quantile = (sorted: number[], p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

/** Расстояние по земле, км. Точности «сколько сотен вёрст» хватает с запасом. */
const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const dLat = (lat2 - lat1) * 111;
    const dLon = (lon2 - lon1) * 111 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
    return Math.hypot(dLat, dLon);
};

export const getDedicationStats = async (slug: string): Promise<DedicationStats> => {
    const temples = await collection();
    const where = { ...filterOf({ dedication: slug }) };

    const [rows, countryTotals] = await Promise.all([
        temples.find(where, { projection: { _id: 0, latitude: 1, longitude: 1, year: 1, country: 1 } }).toArray(),
        // Общее число храмов по странам — знаменатель для превышения. Без него
        // карта посвящений показывала бы плотность населения, а не почитание:
        // в Московской области храмов больше всяких, и всякое посвящение там
        // «встречается чаще».
        temples.aggregate([
            { $match: filterOf({}) },
            { $group: { _id: "$country", n: { $sum: 1 } } },
        ]).toArray(),
    ]);

    const count = rows.length;
    if (!count) return { count: 0, center: null, radiusMedianKm: null, radius80Km: null, years: null, decades: [], countries: [] };

    const lats = rows.map((t: any) => t.latitude).sort((a, b) => a - b);
    const lons = rows.map((t: any) => t.longitude).sort((a, b) => a - b);
    const center = { lat: quantile(lats, 0.5), lon: quantile(lons, 0.5) };

    const distances = rows
        .map((t: any) => distanceKm(center.lat, center.lon, t.latitude, t.longitude))
        .sort((a, b) => a - b);

    const yearList = rows
        .map((t: any) => t.year)
        .filter((y: unknown): y is number => typeof y === "number" && y > 300 && y <= new Date().getUTCFullYear())
        .sort((a: number, b: number) => a - b);

    const buckets = new Map<number, number>();
    for (const year of yearList) {
        const from = Math.floor(year / 50) * 50;
        buckets.set(from, (buckets.get(from) ?? 0) + 1);
    }

    // Храмы БЕЗ страны в знаменатель не идут. Доля считается внутри страны, и
    // мешать к ней тех, у кого страны нет (приграничные и островные, где
    // грубые границы не сработали), значит занижать общую долю — а с нею
    // завышать всякое превышение над ней.
    const totalByCountry = new Map<string, number>(
        countryTotals.filter((r: any) => r._id).map((r: any) => [r._id, r.n]));
    const allTemples = [...totalByCountry.values()].reduce((a, b) => a + b, 0);
    const mineByCountry = new Map<string, number>();
    for (const t of rows as any[]) {
        if (!t.country) continue;
        mineByCountry.set(t.country, (mineByCountry.get(t.country) ?? 0) + 1);
    }
    // И числитель общей доли — тоже только те, у кого страна известна: иначе
    // сравниваются доли, посчитанные от разных множеств.
    const mineWithCountry = [...mineByCountry.values()].reduce((a, b) => a + b, 0);
    const baseShare = mineWithCountry / Math.max(1, allTemples);

    return {
        count,
        center,
        radiusMedianKm: Math.round(quantile(distances, 0.5)),
        radius80Km: Math.round(quantile(distances, 0.8)),
        years: yearList.length >= ENOUGH_FOR_STATS
            ? {
                median: quantile(yearList, 0.5),
                q1: quantile(yearList, 0.25),
                q3: quantile(yearList, 0.75),
                known: yearList.length,
            }
            : null,
        decades: [...buckets].sort((a, b) => a[0] - b[0]).map(([from, n]) => ({ from, count: n })),
        countries: [...mineByCountry]
            .map(([code, n]) => {
                const total = totalByCountry.get(code) ?? 0;
                const share = total ? n / total : 0;
                return { code, count: n, share, lift: baseShare ? share / baseShare : 0 };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 12),
    };
};

/** Посвящения с числом храмов — для указателя географии. */
export const getDedicationsWithCounts = async () => {
    const counts = await getDedicationCounts();
    const dedications = await (await clientPromise).db("typikon").collection("dedications")
        .find({}, { projection: { _id: 0, slug: 1, short: 1, label: 1, kind: 1 } }).toArray();
    const bySlug = new Map(dedications.map((d: any) => [d.slug, d]));
    return counts
        .filter((c) => bySlug.has(c.slug))
        .map((c) => ({ ...bySlug.get(c.slug)!, count: c.count } as any));
};
