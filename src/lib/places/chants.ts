// Песнопения, где названо место: упоминания из place_mentions (corpus: "chant") и
// подписи строк из корпуса typikon-rules — что за песнопение и к какой памяти.
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { rulesDb } from "@/lib/rulesDb";
import { cached, CacheTag } from "@/lib/cache";
import { reportError } from "@/lib/reportError";
import { labelOf, UNIT_LABELS } from "@/utils/chantLabels";
import { PLACE_MENTIONS } from "@/lib/places/schema";

export interface PlaceChant { id: string; unit: string; memory: string | null; context: string }

const SHOWN = 40;

const load = async (placeId: string): Promise<{ total: number; items: PlaceChant[] }> => {
    try {
        const coll = (await clientPromise).db("typikon").collection(PLACE_MENTIONS);
        const filter = { placeId: new ObjectId(placeId), corpus: "chant", status: "approved" };
        const [total, rows] = await Promise.all([
            coll.countDocuments(filter),
            coll.find(filter, { projection: { chantRef: 1, context: 1 } }).limit(2000).toArray(),
        ]);
        // Одну строку печатают многие издания и службы: показываем разные тексты, а не копии.
        const seen = new Set<string>();
        const unique = rows.filter((r) => {
            if (seen.has(r.context)) return false;
            seen.add(r.context);
            return true;
        }).slice(0, SHOWN);

        const labels = new Map<string, { unit: string; memory: string | null }>();
        const rules = rulesDb();
        if (rules && unique.length) {
            const ids = unique.map((r) => Number(r.chantRef)).filter(Number.isFinite);
            const found = rules.prepare(`
                SELECT ci.item_id, ci.content_unit, m.label AS memory
                FROM content_items ci
                LEFT JOIN groups g ON g.group_id = ci.group_id
                LEFT JOIN canons c ON c.canon_id = ci.canon_id
                LEFT JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id)
                WHERE ci.item_id IN (${ids.map(() => "?").join(",")})
            `).all(...ids) as { item_id: number; content_unit: string; memory: string | null }[];
            for (const f of found) labels.set(String(f.item_id), { unit: labelOf(UNIT_LABELS, f.content_unit), memory: f.memory });
        }

        return {
            total,
            items: unique.map((r) => ({
                id: String(r.chantRef),
                unit: labels.get(String(r.chantRef))?.unit ?? "песнопение",
                memory: labels.get(String(r.chantRef))?.memory ?? null,
                context: r.context,
            })),
        };
    } catch (e) {
        reportError(e, { where: "lib/places/chants#load" });
        return { total: 0, items: [] };
    }
};

export const placeChants = cached(load, ["place-chants"], [CacheTag.PLACES]);
