// Проставляет books.bibleLanguageCode и texts.bibleBookSlug для уже импортированных
// изданий Библии (церковнославянское и румынское), чтобы зачала могли резолвиться
// в стихи нужного языка независимо от порядка/состава книг конкретного издания.
//
// Slug берётся из уже сохранённого alias (biblia-{lang}-{slug}-{bookIndex}) —
// не перепечатываем список книг заново, он уже надёжно зафиксирован при импорте.
//
// Запуск: npx tsx src/scripts/tag-bible-books.ts
import "@/scripts/lib/env";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const EDITIONS: Array<{ bookId: string; lang: string; aliasPrefix: string }> = [
    { bookId: "6a8202a20ee48daf61f4247f", lang: "cs", aliasPrefix: "biblia-cs-" },
    { bookId: "6989959c169656dfeafaa36a", lang: "ro", aliasPrefix: "biblia-rom-" },
];

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");

    for (const edition of EDITIONS) {
        const bookId = new ObjectId(edition.bookId);
        await db.collection("books").updateOne(
            { _id: bookId },
            { $set: { bibleLanguageCode: edition.lang, updatedAt: new Date() } }
        );

        const texts = await db.collection("texts").find({ bookId }).toArray();
        let tagged = 0;
        for (const text of texts) {
            if (!text.alias?.startsWith(edition.aliasPrefix)) {
                console.warn(`!! ${text.name} — alias "${text.alias}" не начинается с "${edition.aliasPrefix}", пропускаю`);
                continue;
            }
            const rest = text.alias.slice(edition.aliasPrefix.length); // "{slug}-{bookIndex}"
            const match = rest.match(/^(.+)-(\d+)$/);
            if (!match) {
                console.warn(`!! ${text.name} — не удалось выделить slug из alias "${text.alias}"`);
                continue;
            }
            const slug = match[1];
            await db.collection("texts").updateOne(
                { _id: text._id },
                { $set: { bibleBookSlug: slug, updatedAt: new Date() } }
            );
            tagged++;
        }
        console.log(`${edition.lang}: помечено книг — ${tagged} из ${texts.length}`);
    }
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
