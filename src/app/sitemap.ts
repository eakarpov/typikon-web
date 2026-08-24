import {MetadataRoute} from "next";
import clientPromise from "@/lib/mongodb";
import {TextReadiness} from "@/utils/texts";

// Карта сайта строится из базы, а не лежит статикой в public/: раньше файл
// генерировался внешним сервисом и с 2024 года не обновлялся, поэтому новые
// чтения в индекс не попадали. Пересобирается раз в сутки.
export const revalidate = 86400;

const BASE_URL = "https://typikon.su";

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
    { path: "/triodion", priority: 0.8 },
    { path: "/penticostarion", priority: 0.8 },
    { path: "/rest-readings", priority: 0.8 },
    { path: "/commons", priority: 0.7 },
    { path: "/signs", priority: 0.6 },
    { path: "/calculator", priority: 0.6 },
    { path: "/resources", priority: 0.5 },
    { path: "/about", priority: 0.5 },
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
        ]);
    } catch (e) {
        console.error(e);
        // Пустая карта хуже устаревшей, но лучше пятисотки на /sitemap.xml.
        return STATIC_ROUTES.map(({ path, priority }) =>
            entry(path, new Date(), priority, "daily"));
    }
}
