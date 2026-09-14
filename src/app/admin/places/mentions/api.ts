import clientPromise from "@/lib/mongodb";
import { reportError } from "@/lib/reportError";
import { PLACE_MENTIONS, PLACES } from "@/lib/places/schema";

export interface PlaceMentionItem {
    id: string;
    textId: string;
    textName: string;
    textAlias: string | null;
    word: string;
    context: string;
    signal: string;
    count: number;
    method: string;
    status: string;
}

export interface PlaceGroup {
    placeId: string;
    placeName: string;
    placeSlug: string | null;
    items: PlaceMentionItem[];
    pending: number;
    approved: number;
    rejected: number;
}

/**
 * Упоминания мест в текстах — по месту. Ошибки кучкуются так же, как у святых: если
 * имя места совпало с обычным словом или с человеком, мимо идёт вся его пачка, и
 * решать удобнее сразу по месту. Сначала места с неразобранным.
 */
export const getPlaceGroups = async (onlyPending: boolean): Promise<[PlaceGroup[] | null, any]> => {
    try {
        const db = (await clientPromise).db("typikon");
        const rows = await db.collection(PLACE_MENTIONS).aggregate([
            { $match: { corpus: "text", ...(onlyPending ? { status: "pending" } : {}) } },
            { $lookup: { from: "texts", localField: "textId", foreignField: "_id", as: "text", pipeline: [{ $project: { name: 1, alias: 1 } }] } },
            { $lookup: { from: PLACES, localField: "placeId", foreignField: "_id", as: "place", pipeline: [{ $project: { name: 1, slug: 1 } }] } },
        ]).toArray();

        const groups = new Map<string, PlaceGroup>();
        for (const r of rows) {
            const key = String(r.placeId);
            const group: PlaceGroup = groups.get(key) ?? {
                placeId: key, placeName: r.place[0]?.name ?? key, placeSlug: r.place[0]?.slug ?? null,
                items: [], pending: 0, approved: 0, rejected: 0,
            };
            group.items.push({
                id: String(r._id),
                textId: String(r.textId),
                textName: r.text[0]?.name ?? "",
                textAlias: r.text[0]?.alias ?? null,
                word: r.word ?? "",
                context: r.context ?? "",
                signal: r.signal ?? r.method,
                count: r.count ?? 1,
                method: r.method,
                status: r.status,
            });
            if (r.status === "approved") group.approved++;
            else if (r.status === "rejected") group.rejected++;
            else group.pending++;
            groups.set(key, group);
        }
        const list = [...groups.values()].sort((a, b) => (b.pending - a.pending) || (b.items.length - a.items.length));
        return [list, null];
    } catch (e) {
        reportError(e, { where: "app/admin/places/mentions/api#getPlaceGroups" });
        return [null, e];
    }
};
