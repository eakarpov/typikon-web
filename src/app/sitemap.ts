import {MetadataRoute} from "next";
import { saintSlugs } from "@/lib/saints";
import clientPromise from "@/lib/mongodb";
import {TextReadiness} from "@/utils/texts";
import {BIBLE_CANON} from "@/utils/bibleCanon";
import {REFERENCE_VERSIFICATION} from "@/utils/bibleVersification";

// Карта сайта строится из базы, а не лежит статикой в public/: раньше файл
// генерировался внешним сервисом и с 2024 года не обновлялся, поэтому новые
// чтения в индекс не попадали. Пересобирается раз в сутки.
export const revalidate = 86400;

const BASE_URL = "https://www.typikon.su";

// Тексты в статусах "в наличии"/"пока отсутствует" — это заготовки без содержимого,
// в индексе им делать нечего.
const READABLE_TEXTS = [
    TextReadiness.READY,
    TextReadiness.CORRECTION,
    TextReadiness.TEXTING,
];

const STATIC_ROUTES = [
    { path: "", priority: 1 },
    { path: "/calendar", priority: 0.9 },
    { path: "/calendar/today", priority: 0.9 },
    { path: "/library", priority: 0.9 },
    { path: "/bible", priority: 0.9 },
    { path: "/saints", priority: 0.8 },
    { path: "/accents", priority: 0.7 },
    { path: "/triodion", priority: 0.8 },
    { path: "/penticostarion", priority: 0.8 },
    { path: "/rest-readings", priority: 0.8 },
    { path: "/commons", priority: 0.7 },
    { path: "/signs", priority: 0.6 },
    { path: "/calculator", priority: 0.6 },
    { path: "/resources", priority: 0.5 },
    { path: "/about", priority: 0.5 },
    { path: "/license", priority: 0.4 },
    { path: "/api", priority: 0.4 },
    { path: "/data", priority: 0.5 },
    { path: "/contact", priority: 0.4 },
];

const toDate = (value: any): Date => {
    const date = value ? new Date(value) : null;
    return date && !isNaN(date.getTime()) ? date : new Date();
};

const entry = (
    path: string,
    lastModified: any,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly",
) => ({
    url: `${BASE_URL}${path}`,
    lastModified: toDate(lastModified),
    changeFrequency,
    priority,
});

const dedupe = (items: MetadataRoute.Sitemap): MetadataRoute.Sitemap => {
    const byUrl = new Map<string, MetadataRoute.Sitemap[number]>();
    items.forEach((item) => {
        const previous = byUrl.get(item.url);
        if (!previous || toDate(previous.lastModified) < toDate(item.lastModified)) {
            byUrl.set(item.url, item);
        }
    });
    return [...byUrl.values()];
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const [texts, months, books, weeks] = await Promise.all([
            db.collection("texts")
                .find({
                    alias: { $nin: ["", null] },
                    name: { $nin: ["", null] },
                    readiness: { $in: READABLE_TEXTS },
                }, { projection: { alias: 1, updatedAt: 1 } })
                .toArray(),
            db.collection("months")
                .find({ alias: { $nin: ["", null] } }, { projection: { alias: 1, updatedAt: 1 } })
                .toArray(),
            db.collection("books")
                .find({ public: { $ne: false } }, { projection: { updatedAt: 1 } })
                .toArray(),
            db.collection("weeks")
                .find({ $or: [{ penticostration: true }, { triodion: true }] },
                    { projection: { days: 1, penticostration: 1, triodion: 1 } })
                .toArray(),
        ]);

        // Пасхальные дни живут под /penticostarion/{alias} и /triodion/{alias},
        // неподвижный круг — под /calendar/{alias}. Разводим их, чтобы один и тот же
        // день не попал в карту дважды под разными адресами.
        const paschalSection = new Map<string, "penticostarion" | "triodion">();
        weeks.forEach((week) => {
            const section = week.penticostration ? "penticostarion" : "triodion";
            (week.days || []).forEach((dayId: any) => {
                paschalSection.set(dayId.toString(), section);
            });
        });

        // Страницы святых: дата правки — самая свежая среди наших текстов этой памяти.
        // Адрес с 2026-08-31 наш собственный (`saints.slug`); номер святцев остаётся
        // рабочим и уводит редиректом, но в карту сайта идёт конечный адрес, а не тот,
        // с которого перебрасывает.
        const saints = await db.collection("texts").aggregate([
            {
                $match: {
                    readiness: { $in: READABLE_TEXTS },
                    $or: [
                        { dneslovId: { $nin: [null, ""] } },
                        { mentionIds: { $exists: true, $ne: [] } },
                    ],
                },
            },
            {
                $project: {
                    updatedAt: 1,
                    saintIds: {
                        $setUnion: [
                            { $cond: [{ $in: ["$dneslovId", [null, ""]] }, [], ["$dneslovId"]] },
                            { $ifNull: ["$mentionIds", []] },
                        ],
                    },
                },
            },
            { $unwind: "$saintIds" },
            { $group: { _id: "$saintIds", updatedAt: { $max: "$updatedAt" } } },
        ]).toArray();

        // Номер святцев -> наш адрес. Памяти, до которой каталог ещё не дошёл,
        // в карте остаётся номер: страница по нему работает.
        const saintAddresses = await saintSlugs(saints.map((saint: any) => String(saint._id)));

        const days = await db.collection("days")
            .find({ alias: { $nin: ["", null] } }, { projection: { alias: 1, updatedAt: 1, paschal: 1 } })
            .toArray();

        const dayEntries = days.map((day) => {
            const section = day.paschal
                ? paschalSection.get(day._id.toString())
                : undefined;
            if (day.paschal && !section) {
                return null;
            }
            return entry(
                `/${section || "calendar"}/${day.alias}`,
                day.updatedAt,
                0.8,
                "yearly",
            );
        }).filter(Boolean) as MetadataRoute.Sitemap;

        // Библейских книг в `texts` больше нет — они в своих коллекциях, а прежние
        // адреса /reading/biblia-* отвечают постоянным редиректом. В карту вместо
        // них идут главы.
        //
        // Список глав — по эталонной версификации, а не запросом: она и есть
        // список глав церковнославянского издания, лежит прямо в коде и стоит нуля
        // обращений к базе. Главы с нулём стихов пропускаем: в издании их нет
        // (в Исходе так с 37-й по 39-ю — в источнике текст без стиховой разбивки).
        const bibleUpdatedAt = (await db.collection("bible_editions")
            .findOne({}, { sort: { updatedAt: -1 }, projection: { updatedAt: 1 } }))?.updatedAt;

        const bibleChapters = BIBLE_CANON.flatMap((book) =>
            (REFERENCE_VERSIFICATION[book.id] || [])
                .map((verses, index) => (verses > 0 ? index + 1 : 0))
                .filter(Boolean)
                .map((chapter) => entry(`/bible/${book.id}/${chapter}`, bibleUpdatedAt, 0.6, "yearly")));

        // В базе встречаются документы с одинаковым alias — в карте один адрес
        // должен быть ровно один раз.
        return dedupe([
            ...STATIC_ROUTES.map(({ path, priority }) =>
                entry(path, new Date(), priority, "daily")),
            ...dayEntries,
            ...texts.map((text) =>
                entry(`/reading/${text.alias}`, text.updatedAt, 0.7, "yearly")),
            ...months.map((month) =>
                entry(`/months/${month.alias}`, month.updatedAt, 0.6, "monthly")),
            ...books.map((book) =>
                entry(`/library/${book._id.toString()}`, book.updatedAt, 0.6, "monthly")),
            ...saints.map((saint) =>
                entry(`/saints/${saintAddresses[String(saint._id)] ?? saint._id}`, saint.updatedAt, 0.6, "monthly")),
            ...bibleChapters,
        ]);
    } catch (e) {
        console.error(e);
        // Пустая карта хуже устаревшей, но лучше пятисотки на /sitemap.xml.
        return STATIC_ROUTES.map(({ path, priority }) =>
            entry(path, new Date(), priority, "daily"));
    }
}
