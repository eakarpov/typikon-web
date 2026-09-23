// Состав поездки по дням: чтения, престольные праздники остановок, памяти
// святых маршрута, святыни. Чистая часть — ./trip.

import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { reportError } from "@/lib/reportError";
import { getDedication, getTemple } from "@/lib/temples";
import { calcDayCached } from "@/lib/api/v2/calendar";
import { memoryDayOf } from "@/lib/saintFacts";
import { PLACES } from "@/lib/places/schema";
import { placeHref } from "@/lib/places/query";
import { DEFAULT_BIBLE_LANGUAGE } from "@/utils/bibleLanguage";
import { feastsBetween } from "@/utils/feastDate";
import { humanDate } from "@/app/pomyannik/labels";
import { relicsForTrip } from "./relicsStore";
import type { Relic } from "./relics";
import { saveListOf, type SaveItem, type TripRequest } from "./trip";

export interface PlanStop {
    kind: "temple" | "place";
    slug: string;
    name: string;
    href: string;
    /** Престолы — для храма; у места пусто. */
    dedications: string[];
    relics: Relic[];
}

export interface PlanDay {
    date: string;
    /** Главная память дня и имя дня Триоди, как в календарной ленте. */
    title: string | null;
    feasts: { stop: string; href: string; label: string }[];
    /** Памяти святых, чьи мощи или престолы на маршруте. */
    memories: { name: string; href: string | null; why: string }[];
}

export interface Plan { days: PlanDay[]; stops: PlanStop[]; save: SaveItem[] }

const CONCURRENCY = 6;

const dayTitle = async (date: string): Promise<string | null> => {
    try {
        const result: any = await calcDayCached(date, DEFAULT_BIBLE_LANGUAGE);
        const main = result?.memories?.default?.name;
        const dayName = result?.day?.name;
        return [main, dayName && dayName !== main ? dayName : null].filter(Boolean).join(" — ") || null;
    } catch (e) {
        reportError(e, { where: "lib/pilgrimage/plan#dayTitle", extra: { date } });
        return null;
    }
};

const loadStop = async (s: TripRequest["stops"][number]) => {
    if (s.kind === "temple") {
        const temple = await getTemple(s.slug);
        if (!temple) return null;
        const docs = await Promise.all((temple.prestoly ?? [])
            .filter((p) => p.state !== "lost")
            .map((p) => getDedication(p.dedication)));
        return { kind: "temple" as const, slug: temple.slug, name: temple.name, href: `/temples/${temple.slug}`, docs: docs.filter(Boolean) };
    }
    const place = await (await clientPromise).db("typikon").collection(PLACES)
        .findOne({ $or: [{ slug: s.slug }, { alias: s.slug }], published: { $ne: false } },
            { projection: { name: 1, slug: 1, alias: 1 } });
    if (!place) return null;
    return { kind: "place" as const, slug: s.slug, name: place.name as string, href: placeHref(place), docs: [] };
};

/**
 * Святые маршрута с днями памяти — из нашего каталога. Святыни ссылаются на
 * запись каталога её ключом, престолы — номером святцев (так их связывает
 * словарь посвящений); сводим оба к записи и дальше считаем по ней.
 */
const routeSaints = async (ids: string[], dneslovIds: string[]) => {
    const or: any[] = [];
    const oids = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (oids.length) or.push({ _id: { $in: oids } });
    if (dneslovIds.length) or.push({ externals: { $elemMatch: { source: "dneslov", id: { $in: dneslovIds } } } });
    if (!or.length) return [];
    const rows = await (await clientPromise).db("typikon").collection("saints")
        .find({ $or: or }, { projection: { name: 1, slug: 1, memoryDates: 1, externals: 1 } })
        .toArray();
    return rows as unknown as { _id: ObjectId; name: string; slug: string | null; memoryDates?: string[]; externals?: { source: string; id: string }[] }[];
};

export const buildPlan = async (req: TripRequest, days: string[]): Promise<Plan> => {
    const loaded = (await Promise.all(req.stops.map(loadStop))).filter((s): s is NonNullable<typeof s> => !!s);

    const relics = await relicsForTrip(
        loaded.filter((s) => s.kind === "temple").map((s) => s.slug),
        loaded.filter((s) => s.kind === "place").map((s) => s.slug),
        req.from, req.to,
    );

    const stops: PlanStop[] = loaded.map((s) => ({
        kind: s.kind, slug: s.slug, name: s.name, href: s.href,
        dedications: s.docs.map((d: any) => d.short ?? d.slug),
        relics: relics.filter((r) => (s.kind === "temple" ? r.templeSlug : r.placeId) === s.slug),
    }));

    const from = new Date(`${req.from}T00:00:00Z`);
    const to = new Date(`${req.to}T00:00:00Z`);

    // Престольные праздники остановок, попавшие в дни поездки.
    const feastsByDay = new Map<string, PlanDay["feasts"]>();
    for (const s of loaded) {
        for (const d of s.docs as any[]) {
            for (const hit of feastsBetween(d.feasts ?? [], from, to)) {
                const date = hit.date.toISOString().slice(0, 10);
                const list = feastsByDay.get(date) ?? [];
                list.push({ stop: s.name, href: s.href, label: d.short ?? d.label ?? d.slug });
                feastsByDay.set(date, list);
            }
        }
    }

    // Святые маршрута: чьи мощи на остановках и за кем выверенно стоят их престолы.
    const whyById = new Map<string, string>();
    for (const r of relics) whyById.set(r.saintId, `мощи — ${r.siteName}`);
    const whyByNumber = new Map<string, string>();
    for (const s of loaded) for (const d of s.docs as any[]) {
        for (const saint of d.saints ?? []) {
            const why = `престол — ${s.name}`;
            // Ключ каталога, когда словарь его знает; номер святцев — для прежней сборки словаря.
            if (saint.saintId) { if (!whyById.has(saint.saintId)) whyById.set(saint.saintId, why); }
            else if (saint.dneslovId && !whyByNumber.has(saint.dneslovId)) whyByNumber.set(saint.dneslovId, why);
        }
    }
    const memoriesByDay = new Map<string, PlanDay["memories"]>();
    for (const saint of await routeSaints([...whyById.keys()], [...whyByNumber.keys()])) {
        const number = (saint.externals ?? []).find((e) => e.source === "dneslov" && whyByNumber.has(String(e.id)))?.id;
        const why = whyById.get(String(saint._id)) ?? (number ? whyByNumber.get(String(number)) : undefined) ?? "";
        for (const raw of saint.memoryDates ?? []) {
            const day = memoryDayOf(raw, from);
            if (!day?.iso || day.iso > req.to) continue;
            const list = memoriesByDay.get(day.iso) ?? [];
            list.push({ name: saint.name, href: saint.slug ? `/saints/${saint.slug}` : null, why });
            memoriesByDay.set(day.iso, list);
        }
    }

    const titles: (string | null)[] = [];
    for (let i = 0; i < days.length; i += CONCURRENCY) {
        titles.push(...await Promise.all(days.slice(i, i + CONCURRENCY).map(dayTitle)));
    }

    const saintPages = relics
        .filter((r) => r.saintSlug)
        .map((r) => ({ href: `/saints/${r.saintSlug}`, name: r.saintName }));

    return {
        days: days.map((date, i) => ({
            date,
            title: titles[i],
            feasts: feastsByDay.get(date) ?? [],
            memories: memoriesByDay.get(date) ?? [],
        })),
        stops,
        save: saveListOf(days, stops, saintPages, (d) => humanDate(d)),
    };
};
