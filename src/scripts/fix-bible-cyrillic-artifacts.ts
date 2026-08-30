// Убирает артефакт OCR-извлечения романской Библии (bible_cyrillic.txt): бегущий
// колонтитул следующей книги, приклеенный либо к концу последнего реального стиха,
// либо (чаще) попавший в файл отдельной "поддельной" строкой с фиктивным номером
// стиха сразу после настоящего последнего стиха. Переносит этот текст в название
// следующей книги, а последний стих предыдущей — очищает (или удаляет полностью,
// если он целиком состоит из артефакта).
//
// Идемпотентен: если подстрока заголовка уже не найдена в стихе (граница уже
// почищена в прошлый запуск), просто пропускает без предупреждения.
//
// Запуск: npx tsx src/scripts/fix-bible-cyrillic-artifacts.ts
import "@/scripts/lib/env";
import fs from "fs";
import path from "path";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const FILE_PATH = path.join(process.cwd(), "romanian/output/bible_cyrillic.txt");
const BOOK_ID = "6989959c169656dfeafaa36a"; // Сфънта Скриптура (Библия - на румынской кириллице)

// Печатный колонтитул иногда сформулирован иначе, чем заголовок раздела в файле —
// единственный известный случай подобрали вручную, сверившись с сырым текстом.
const TITLE_OVERRIDES: Record<string, string> = {
    "Ва́ль шѝ балаꙋрꙋль": "І҆сᲄо́рїѧ Бала́ꙋрꙋлꙋй",
};

// Печатный колонтитул не содержит наших уточнений вида "(1)"/"#2"/"(посл.)" —
// они добавлены только чтобы различать одноимённые книги/послания в файле.
const baseTitle = (title: string): string =>
    title
        .replace(/\s*\(посл\.\)$/i, "")
        .replace(/^\d+\s+/, "")
        .replace(/\s*\(\d+\)$/, "")
        .replace(/\s*#\d+$/, "")
        .trim();

const splitIntoBooks = (raw: string): string[] => {
    const headerPattern = /^===== (.+) =====$/gm;
    return [...raw.matchAll(headerPattern)].map(m => m[1]);
};


// ОТРАБОТАВШИЙ СКРИПТ. Он писал в прежнюю модель (books/texts/verses), которой
// больше нет: Библия живёт в bible_editions/bible_books/bible_verses
// (@/lib/bible/schema). Оставлен ради разбора источника — это единственное место,
// где записано, как из него добывались стихи, а корпус ещё придётся дочищать
// (в церковнославянском Исходе нет глав 37–39: в источнике они без стиховой
// разбивки). Прежде чем запускать снова, перепишите запись под новые коллекции.
//
// Пока этого не сделано, скрипт отказывается работать: молча залить корпус в
// мёртвые коллекции хуже, чем не залить вовсе.

const main = async () => {
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    const titles = splitIntoBooks(raw); // titles[0] = Бытие ... titles[78] = Откровение

    const client = await clientPromise;
    const db = client.db("typikon");

    const texts = await db.collection("texts")
        .find({ bookId: new ObjectId(BOOK_ID) })
        .sort({ bookIndex: 1 })
        .toArray();

    if (texts.length !== titles.length) {
        throw new Error(`Число книг в базе (${texts.length}) не совпадает с числом заголовков в файле (${titles.length})`);
    }

    let fixed = 0;
    let alreadyClean = 0;
    const needsReview: string[] = [];

    for (let i = 0; i < texts.length - 1; i++) {
        const prevText = texts[i];
        const nextText = texts[i + 1];
        const nextTitle = titles[i + 1];

        const lastVerse = await db.collection("verses")
            .find({ textId: prevText._id })
            .sort({ chapter: -1, verse: -1 })
            .limit(1)
            .next();

        if (!lastVerse) {
            needsReview.push(`${prevText.name} — нет стихов`);
            continue;
        }

        const candidates = [
            TITLE_OVERRIDES[nextTitle],
            nextTitle,
            baseTitle(nextTitle),
        ].filter((c, idx, arr): c is string => !!c && arr.indexOf(c) === idx);

        let matchedTitle: string | null = null;
        let idx = -1;
        for (const candidate of candidates) {
            const pos = lastVerse.content.lastIndexOf(candidate);
            if (pos >= 0) {
                matchedTitle = candidate;
                idx = pos;
                break;
            }
        }

        if (idx < 0) {
            alreadyClean++;
            continue;
        }

        const cleanedContent = lastVerse.content.slice(0, idx).trimEnd();
        const artifactTail = lastVerse.content.slice(idx);
        const extra = artifactTail.slice(matchedTitle!.length).trim();

        if (idx === 0) {
            // Весь стих целиком — артефакт (фиктивный номер стиха), удаляем документ.
            await db.collection("verses").deleteOne({ _id: lastVerse._id });
        } else {
            await db.collection("verses").updateOne(
                { _id: lastVerse._id },
                { $set: { content: cleanedContent, updatedAt: new Date() } }
            );
        }

        if (extra) {
            await db.collection("texts").updateOne(
                { _id: nextText._id },
                { $set: { name: `${nextText.name} - ${extra}`, updatedAt: new Date() } }
            );
        }

        const mode = idx === 0 ? "удалён фиктивный стих" : "обрезан хвост стиха";
        console.log(`OK (${mode}): ${prevText.name} -> ${nextText.name}${extra ? ` (+"${extra}")` : " (без доп. текста)"}`);
        fixed++;
    }

    console.log(`\nИсправлено границ: ${fixed}, уже было чисто: ${alreadyClean}`);
    if (needsReview.length > 0) {
        console.log(`Нужна ручная проверка: ${needsReview.length}`);
        needsReview.forEach(n => console.log(`  - ${n}`));
    }
};

if (!process.argv.includes("--i-rewrote-it")) {
    console.error(
        "Скрипт отработал и писал в прежнюю модель Библии (books/texts/verses), которой больше нет. " +
        "Перепишите запись под bible_editions/bible_books/bible_verses — см. шапку файла."
    );
    process.exit(1);
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
