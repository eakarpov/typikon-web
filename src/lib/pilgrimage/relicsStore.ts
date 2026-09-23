// Реестр святынь: запись, разбор и выборки. Вид записи и её проверка — ./relics.

import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { reportError } from "@/lib/reportError";
import { getTemple } from "@/lib/temples";
import { dneslovIdsOf, getSaintByAddress, saintNames, saintSlugs } from "@/lib/saints";
import { PLACES } from "@/lib/places/schema";
import { placeCoordinates } from "@/lib/places/legacy";
import { isCurrent, overlaps, RELICS, type Relic, type RelicInput, type RelicStatus } from "./relics";

const relics = async () => (await clientPromise).db("typikon-users").collection(RELICS);

const today = () => new Date().toISOString().slice(0, 10);

const toRelic = (row: any): Relic => ({
    id: String(row._id),
    saintDneslovId: row.saintDneslovId,
    saintName: row.saintName,
    saintSlug: row.saintSlug ?? null,
    kind: row.kind,
    state: row.state,
    templeSlug: row.templeSlug ?? null,
    placeId: row.placeId ?? null,
    siteName: row.siteName,
    ...(row.where ? { where: row.where } : {}),
    ...(row.visit ? { visit: row.visit } : {}),
    location: row.location,
    source: row.source,
    ...(row.note ? { note: row.note } : {}),
    status: row.status,
    createdBy: row.createdBy ?? null,
    reviewedBy: row.reviewedBy ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
});

/**
 * Что выводится из введённого: имя святого, имя места и точка. Храм или место
 * должны быть в каталоге и иметь координаты — святыня без точки не видна ни на
 * карте, ни в своде «что рядом», и принимать её незачем.
 */
const resolve = async (input: RelicInput): Promise<
    { ok: true; saintName: string; saintSlug: string | null; siteName: string; location: Relic["location"] }
    | { ok: false; error: string }
> => {
    const [names, slugs] = await Promise.all([saintNames([input.saintDneslovId]), saintSlugs([input.saintDneslovId])]);
    const saintName = names[input.saintDneslovId];
    if (!saintName) return { ok: false, error: "святого с таким номером святцев в каталоге нет" };

    if (input.templeSlug) {
        const temple = await getTemple(input.templeSlug);
        if (!temple) return { ok: false, error: "храма с таким адресом нет" };
        if (!Number.isFinite(temple.latitude) || !Number.isFinite(temple.longitude)) {
            return { ok: false, error: "у храма нет координат" };
        }
        return {
            ok: true, saintName, saintSlug: slugs[input.saintDneslovId] ?? null, siteName: temple.name,
            location: { type: "Point", coordinates: [temple.longitude, temple.latitude] },
        };
    }

    const id = input.placeId!;
    const or: any[] = [{ slug: id }, { alias: id }];
    if (ObjectId.isValid(id)) or.push({ _id: new ObjectId(id) });
    const place = await (await clientPromise).db("typikon").collection(PLACES).findOne({ $or: or });
    const coords = placeCoordinates(place);
    if (!place || !coords) return { ok: false, error: place ? "у места нет координат" : "места с таким адресом нет" };
    return {
        ok: true, saintName, saintSlug: slugs[input.saintDneslovId] ?? null, siteName: place.name,
        location: { type: "Point", coordinates: [coords.longitude, coords.latitude] },
    };
};

/**
 * Адреса, как их вставляет человек: ссылка на страницу сайта или сам адрес.
 * «https://www.typikon.info/saints/sergii-radonezhskii» и «sergii-radonezhskii»
 * значат одно; номер святцев принимается как есть.
 */
export const lastSegment = (raw: unknown): string => {
    const s = String(raw ?? "").trim();
    try {
        const u = new URL(s);
        return decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "");
    } catch {
        return s.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
    }
};

/** Номер святцев по адресу святого на сайте или по самому номеру. */
export const saintIdOf = async (raw: unknown): Promise<string | null> => {
    const address = lastSegment(raw);
    if (!address) return null;
    if (/^\d+$/.test(address)) return address;
    return dneslovIdsOf(await getSaintByAddress(address))[0] ?? null;
};

/** Новая запись: от разбирающего — сразу принятая, от прочих — предложение. */
export const createRelic = async (
    input: RelicInput, userId: string | null, status: RelicStatus,
): Promise<{ id: string } | { error: string }> => {
    const derived = await resolve(input);
    if (!derived.ok) return { error: derived.error };
    const now = new Date();
    const { ok: _ok, ...fields } = derived;
    const res = await (await relics()).insertOne({
        ...input, ...fields, status,
        createdBy: userId, reviewedBy: status === "approved" ? userId : null,
        createdAt: now, updatedAt: now,
    });
    return { id: String(res.insertedId) };
};

export const updateRelic = async (id: string, input: RelicInput, userId: string | null): Promise<{ ok: true } | { error: string }> => {
    if (!ObjectId.isValid(id)) return { error: "нет такой записи" };
    const derived = await resolve(input);
    if (!derived.ok) return { error: derived.error };
    const { ok: _ok, ...fields } = derived;
    // Поля, которых во введённом нет, снимаются: иначе убранное «где именно»
    // или даты пребывания оставались бы в записи от прежней правки.
    const unset: Record<string, ""> = {};
    for (const k of ["where", "visit", "note", "templeSlug", "placeId"] as const) {
        if (input[k] === undefined || input[k] === null) unset[k] = "";
    }
    const res = await (await relics()).updateOne({ _id: new ObjectId(id) }, {
        $set: {
            ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== null)),
            ...fields, reviewedBy: userId, updatedAt: new Date(),
        },
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
    });
    return res.matchedCount ? { ok: true } : { error: "нет такой записи" };
};

export const setRelicStatus = async (id: string, status: RelicStatus, userId: string | null): Promise<boolean> => {
    if (!ObjectId.isValid(id)) return false;
    const res = await (await relics()).updateOne({ _id: new ObjectId(id) },
        { $set: { status, reviewedBy: userId, updatedAt: new Date() } });
    return res.matchedCount > 0;
};

export const deleteRelic = async (id: string): Promise<boolean> => {
    if (!ObjectId.isValid(id)) return false;
    return (await (await relics()).deleteOne({ _id: new ObjectId(id) })).deletedCount > 0;
};

/** Для разбора: всё, по состоянию, новые сверху. */
export const listRelics = async (status?: RelicStatus): Promise<Relic[]> => {
    const rows = await (await relics()).find(status ? { status } : {}).sort({ updatedAt: -1 }).limit(500).toArray();
    return rows.map(toRelic);
};

// ── Для читателя: только принятое ────────────────────────────────────────────

export interface NearRelic extends Relic { distanceKm: number }

/**
 * Святыни у точки: принятые и пребывающие сейчас (или, для поездки, в её дни).
 *
 * Кэш — без даты в ключе и на пять минут: принесённый ковчег должен исчезнуть
 * со страницы в тот же день, когда его увезли, а не через час.
 */
const loadRelicsNear = async (lon: number, lat: number, radiusKm: number): Promise<NearRelic[]> => {
    try {
        const rows = await (await relics()).aggregate([
            { $geoNear: {
                near: { type: "Point", coordinates: [lon, lat] }, distanceField: "distance",
                maxDistance: radiusKm * 1000, spherical: true, query: { status: "approved", state: { $ne: "former" } },
            } },
            { $limit: 100 },
        ]).toArray();
        const t = today();
        return rows.map((r) => ({ ...toRelic(r), distanceKm: Math.round(r.distance / 100) / 10 }))
            .filter((r) => isCurrent(r, t));
    } catch (e) {
        // Пустая коллекция без индекса — не ошибка страницы: святынь просто нет.
        reportError(e, { where: "lib/pilgrimage/relicsStore#relicsNear" });
        return [];
    }
};

export const relicsNear = cached(loadRelicsNear, ["relics-near"], [CacheTag.RELICS], 300);

const loadRelicsOf = async (field: "templeSlug" | "saintDneslovId", values: string[]): Promise<Relic[]> => {
    if (!values.length) return [];
    try {
        const rows = await (await relics())
            .find({ [field]: { $in: values }, status: "approved" })
            .sort({ state: 1, updatedAt: -1 }).toArray();
        return rows.map(toRelic);
    } catch (e) {
        reportError(e, { where: "lib/pilgrimage/relicsStore#relicsOf" });
        return [];
    }
};

/** Святыни храма — все принятые, и прежние тоже: история храма ими не беднеет. */
export const relicsOfTemple = cached((slug: string) => loadRelicsOf("templeSlug", [slug]),
    ["relics-of-temple"], [CacheTag.RELICS], 300);

/** Где пребывают мощи святого — для досье. */
export const relicsOfSaint = cached((dneslovIds: string[]) => loadRelicsOf("saintDneslovId", dneslovIds),
    ["relics-of-saint"], [CacheTag.RELICS], 300);

/** Святыни на остановках поездки, пребывающие хотя бы в один из её дней. */
export const relicsForTrip = async (templeSlugs: string[], placeIds: string[], from: string, to: string): Promise<Relic[]> => {
    if (!templeSlugs.length && !placeIds.length) return [];
    try {
        const rows = await (await relics()).find({
            status: "approved",
            state: { $ne: "former" },
            $or: [{ templeSlug: { $in: templeSlugs } }, { placeId: { $in: placeIds } }],
        }).toArray();
        return rows.map(toRelic).filter((r) => overlaps(r, from, to));
    } catch (e) {
        reportError(e, { where: "lib/pilgrimage/relicsStore#relicsForTrip" });
        return [];
    }
};

/**
 * Введённое в форме — в поля записи: адреса святого, храма и места сводятся к
 * ключам, остальное проверяет validateRelic. Святой, которого не нашли,
 * остаётся пустым, и проверка скажет об этом своими словами.
 */
export const inputFrom = async (body: any): Promise<Record<string, unknown>> => ({
    ...body,
    saintDneslovId: (await saintIdOf(body?.saint ?? body?.saintDneslovId)) ?? "",
    templeSlug: lastSegment(body?.temple ?? body?.templeSlug) || null,
    placeId: lastSegment(body?.place ?? body?.placeId) || null,
});
