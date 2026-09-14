// Разметка {pl|место|подпись} в тексте → упоминания в place_mentions.
//
// Пометку ставит редактор руками, и это уже решение, а не догадка: такие упоминания
// пишутся принятыми (method: "markup"). При каждом сохранении текста набор сверяется
// с разметкой целиком: снятая пометка снимает и упоминание, но упоминания других
// методов (найденные и разобранные на ревью) не трогаются.
import { Db, ObjectId } from "mongodb";
import { PLACE_MENTIONS, PLACES } from "@/lib/places/schema";

/** Пометки текста: ключ места (идентификатор, alias или slug) и подпись. */
export const markupPlaces = (content: string): { key: string; label: string }[] =>
    [...content.matchAll(/\{pl\|([^|}]+)\|([^}]*)\}/g)].map((m) => ({ key: m[1].trim(), label: m[2].trim() }));

export const syncMarkupMentions = async (db: Db, textId: ObjectId, content: string) => {
    const marks = markupPlaces(content ?? "");
    const keys = [...new Set(marks.map((m) => m.key))];
    const or: any[] = [{ alias: { $in: keys } }, { slug: { $in: keys } }];
    const ids = keys.filter((k) => ObjectId.isValid(k)).map((k) => new ObjectId(k));
    if (ids.length) or.push({ _id: { $in: ids } });

    const places = keys.length
        ? await db.collection(PLACES).find({ $or: or }, { projection: { alias: 1, slug: 1 } }).toArray()
        : [];
    const placeOfKey = new Map<string, ObjectId>();
    for (const p of places) {
        placeOfKey.set(String(p._id), p._id);
        if (p.alias) placeOfKey.set(p.alias, p._id);
        if (p.slug) placeOfKey.set(p.slug, p._id);
    }

    const mentions = db.collection(PLACE_MENTIONS);
    const found = new Map<string, { placeId: ObjectId; word: string }>();
    for (const m of marks) {
        const placeId = placeOfKey.get(m.key);
        if (placeId && !found.has(String(placeId))) found.set(String(placeId), { placeId, word: m.label });
    }

    await mentions.deleteMany({
        textId, corpus: "text", method: "markup",
        placeId: { $nin: [...found.values()].map((f) => f.placeId) },
    });
    for (const { placeId, word } of found.values()) {
        const at = content.indexOf(word);
        const context = at >= 0 ? content.slice(Math.max(0, at - 90), at + word.length + 90).replace(/\s+/g, " ").trim() : word;
        await mentions.updateOne(
            { placeId, corpus: "text", textId, canonRef: null, chantRef: null },
            { $set: { method: "markup", status: "approved", word, context, reviewedAt: new Date() } },
            { upsert: true },
        );
    }
    return { marks: marks.length, linked: found.size, unknown: keys.filter((k) => !placeOfKey.has(k)) };
};
