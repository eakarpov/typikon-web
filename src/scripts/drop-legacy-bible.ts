// Уборка прежней модели Библии: книги издания из `texts`, стихи из `verses`,
// отслужившие поля `books.bibleLanguageCode` и `texts.bibleBookSlug`.
//
// Всё это перенесено в bible_editions / bible_books / bible_verses и с тех пор
// лежало нетронутым — чтобы откат был откатом кода, а не восстановлением базы.
// Раздел Библии обжит, сверка сходится, значит можно убирать.
//
// ЭТО УДАЛЕНИЕ, и обратного хода у него нет: перенос читал именно эти коллекции.
// Поэтому перед записью скрипт сам проверяет, что новая модель полна — совпадают
// числа книг и стихов, у каждого стиха есть каноническая ссылка. Не сошлось —
// не удаляет ничего.
//
// Правила приведения к канону после этого применяются пересчётом по новым
// коллекциям: src/scripts/recompute-bible-canon.ts.
//
// Запуск:
//   npx tsx src/scripts/drop-legacy-bible.ts           # что будет удалено
//   npx tsx src/scripts/drop-legacy-bible.ts --apply   # удалить
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { BIBLE_BOOKS, BIBLE_VERSES } from "@/lib/bible/schema";

const APPLY = process.argv.includes("--apply");

const main = async () => {
    const db = (await clientPromise).db("typikon");

    const legacyTexts = await db.collection("texts")
        .find({ contentType: "verses" }, { projection: { _id: 1 } })
        .toArray();
    const legacyTextIds = legacyTexts.map((text) => text._id);

    const legacyVerses = await db.collection("verses").countDocuments();
    const strayVerses = await db.collection("verses").countDocuments({ textId: { $nin: legacyTextIds } });

    const [books, verses, withoutRef] = await Promise.all([
        db.collection(BIBLE_BOOKS).countDocuments(),
        db.collection(BIBLE_VERSES).countDocuments(),
        db.collection(BIBLE_VERSES).countDocuments({ $or: [{ canonRef: { $in: [null, ""] } }, { canonSort: { $lte: 0 } }] }),
    ]);

    console.log("Прежняя модель:");
    console.log(`  книг Библии в texts   — ${legacyTexts.length}`);
    console.log(`  стихов в verses       — ${legacyVerses}`);
    console.log("Новая модель:");
    console.log(`  bible_books           — ${books}`);
    console.log(`  bible_verses          — ${verses}`);
    console.log(`  стихов без канона     — ${withoutRef}`);

    // Предохранители. Каждый закрывает свой способ потерять корпус: неполный
    // перенос, недосчитанный канон и — отдельно — стих, не принадлежащий Библии,
    // который иначе уехал бы вместе с ней.
    const problems: string[] = [];
    if (!legacyTexts.length && !legacyVerses) problems.push("удалять уже нечего");
    if (books < legacyTexts.length) problems.push(`книг перенесено меньше, чем было: ${books} < ${legacyTexts.length}`);
    if (verses < legacyVerses) problems.push(`стихов перенесено меньше, чем было: ${verses} < ${legacyVerses}`);
    if (withoutRef) problems.push(`у ${withoutRef} стихов нет канонической ссылки`);
    if (strayVerses) problems.push(`${strayVerses} стихов не принадлежат книгам Библии — разберитесь до уборки`);

    if (problems.length) {
        console.log("\nНе убираю:");
        problems.forEach((problem) => console.log(`  ✗ ${problem}`));
        process.exit(problems.length === 1 && problems[0] === "удалять уже нечего" ? 0 : 1);
    }

    if (!APPLY) {
        console.log("\nПроверки пройдены. Будет удалено:");
        console.log(`  verses — ${legacyVerses} документов (коллекция целиком)`);
        console.log(`  texts  — ${legacyTexts.length} книг Библии`);
        console.log("  поля books.bibleLanguageCode и books.texts у изданий");
        console.log("\nЗапустите с --apply.");
        return;
    }

    const removedVerses = await db.collection("verses").deleteMany({});
    const removedTexts = await db.collection("texts").deleteMany({ _id: { $in: legacyTextIds } });

    // Оболочка издания в библиотеке остаётся — она ведёт в раздел Библии. Но её
    // оглавление теперь строится по канону, а не по books.texts, и держать там
    // ссылки на удалённые тексты значило бы оставить битый список.
    const clearedBooks = await db.collection("books").updateMany(
        { bibleLanguageCode: { $exists: true } },
        { $unset: { bibleLanguageCode: "", texts: "" } },
    );

    const clearedSlugs = await db.collection("texts").updateMany(
        { bibleBookSlug: { $exists: true } },
        { $unset: { bibleBookSlug: "" } },
    );

    console.log(`\nУдалено стихов: ${removedVerses.deletedCount}`);
    console.log(`Удалено книг Библии из texts: ${removedTexts.deletedCount}`);
    console.log(`Очищено карточек изданий: ${clearedBooks.modifiedCount}`);
    console.log(`Снято bibleBookSlug: ${clearedSlugs.modifiedCount}`);
    console.log("\nИндексы: npx tsx src/scripts/ensure-indexes.ts --apply (старый индекс verses можно снять руками)");
};

main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
