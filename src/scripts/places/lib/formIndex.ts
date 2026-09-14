// Словарь форм имён для поиска мест в прозе и песнопениях (@/lib/places/textmatch).
//
// Общий для link-text-places и link-chant-places: какие имена надёжны и какому месту
// достаётся форма, если она одна у нескольких, решается одинаково.
import type { Db } from "mongodb";
import { normalizeQuery } from "@/lib/search";
import { buildFormIndex, textForms, wordMatches, type IndexedForm } from "@/lib/places/textmatch";
import { PLACE_MENTIONS, PLACES } from "@/lib/places/schema";

export interface PlaceIndex {
    index: Map<string, IndexedForm[]>;
    places: Map<string, { _id: any; name: string }>;
    /**
     * Формы, совпадающие с именем человека: Анатолия — Анатолий, Филиппы — Филипп,
     * Магдала — Магдалина, Тамара. Песнопение обращается к святому по имени, и без
     * признака места такое слово — человек, а не место.
     */
    personalKeys: Set<string>;
}

export const loadPlaceIndex = async (db: Db): Promise<PlaceIndex> => {
    // Формы — надёжные имена: основное, библейские формы Никифора, от редактора, метки
    // Wikidata. Синонимы Wikidata не берутся: у Египта среди них «Фараон».
    const rows = await db.collection(PLACES).find(
        { published: { $ne: false }, name: /[а-яё]/i },
        { projection: { name: 1, names: 1 } },
    ).toArray();
    const reliable = (n: any) => n.lang === "ru" && (n.source !== "wikidata" || n.role !== "variant");

    // Порядок предпочтения: сначала место, чьё основное имя и есть эта форма, затем
    // чаще упомянутое в Писании.
    const scripture = new Map((await db.collection(PLACE_MENTIONS).aggregate([
        { $match: { corpus: "bible", status: "approved" } },
        { $group: { _id: "$placeId", n: { $sum: 1 } } },
    ]).toArray()).map((r) => [String(r._id), r.n as number]));
    const ordered = rows
        .map((p) => ({
            id: String(p._id),
            mainKey: textForms([p.name])[0]?.key,
            forms: textForms([p.name, ...(p.names ?? []).filter(reliable).map((n: any) => n.name)]),
        }))
        .sort((a, b) => (scripture.get(b.id) ?? 0) - (scripture.get(a.id) ?? 0));

    // Две волны: сперва каждое место со своим основным именем, потом прочие формы. Так
    // «Египет» достаётся Египту, а не Древнему Египту, у которого это лишь вариант метки.
    const index = buildFormIndex([
        ...ordered.map((p) => ({ id: p.id, forms: p.forms.filter((f) => f.key === p.mainKey) })),
        ...ordered.map((p) => ({ id: p.id, forms: p.forms })),
    ]);
    // Имена людей — только собственные: указатель имён святцев и первое слово имени в
    // каталоге святых. Прозвища туда не идут: «Кирилл Иерусалимский» сделал бы
    // Иерусалим именем человека. И совпадением считается только падежная форма, не
    // прилагательное.
    const personWords = new Set<string>();
    const add = (s: string | undefined) => {
        const w = normalizeQuery(s ?? "").replace(/[^а-я]/g, "");
        if (w.length >= 3) personWords.add(w);
    };
    for (const n of await db.collection("name_index").find({}, { projection: { name: 1 } }).toArray()) add(n.name);
    for (const s of await db.collection("saints").find({}, { projection: { name: 1, altNames: 1 } }).toArray()) {
        for (const full of [s.name, ...(s.altNames ?? [])]) add((full ?? "").split(/[\s,(]+/)[0]);
    }
    const personalKeys = new Set<string>();
    for (const forms of index.values()) for (const { form } of forms) {
        for (const w of personWords) {
            if (wordMatches(w, form) === "case") { personalKeys.add(form.key); break; }
        }
    }

    return { index, places: new Map(rows.map((p) => [String(p._id), { _id: p._id, name: p.name }])), personalKeys };
};
