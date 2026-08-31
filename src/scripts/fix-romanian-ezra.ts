// Румынская «третья Ездра» — это славянская ВТОРАЯ.
//
// ЧТО БЫЛО НЕ ТАК. Румынская 1688 печатает книгу «КА́Р̾ТѢ А҆̀ ТРЕ́ЇА А҆̀ ЛꙊ́Й
// Е҆́З̾Д̾РА» — третьей Ездрой, — и перенос взял титул буквально. Но Ездры она
// считает по-западному: Неемия у неё «А ДОУА Ездра», вторая. Значит её третья —
// это Ἔσδρας Α Семидесяти, то есть НАША ВТОРАЯ. Из-за буквального прочтения у
// румынской колонки не стало 2-й Ездры вовсе, а 3-я заполнилась чужим текстом:
// сверка показывала «нет» там, где книга есть, и «есть» там, где её нет.
//
// ЧЕМ ДОКАЗАНО, а не предположено:
//   * обе книги начинаются пасхой Иосии — рум. «Шѝ а҆ пръз̾нꙋи́ᲅь І҆ѡ́сїа
//     Па́щиле ꙟ҆ І҆ерⷭ҇ли́м», слав. «И҆ сотворѝ і҆ѡсі́а па́схꙋ во і҆ерⷭ҇ли́мѣ»,
//     а славянская 3-я Ездры начинается родословием («Кни́га є҆́здры прⷪ҇ро́ка
//     втора́ѧ, сы́на сараі́ева»);
//   * у обеих девять глав, а у славянской 3-й Ездры — шестнадцать;
//   * семь глав из девяти сходятся стих в стих (58, 31, 24, 63, 34, 15, 55).
//
// ЗАОДНО КАНОН. После починки румынская честно остаётся без 3-й Ездры — как и
// греческая, и по той же причине: переведена с Септуагинты, а греческого текста
// IV Esdrae не существовало. Объявляем канон греческим, чтобы пустая клетка не
// считалась недоделкой.
//
// ПОЧЕМУ ОТДЕЛЬНЫМ СКРИПТОМ, А НЕ ПЕРЕЗАПУСКОМ. Источник правды поправлен там,
// где ошибка родилась (import-bible-cyrillic.ts) и где объявляется издание
// (migrate-bible.ts), — но перезапустить эту цепочку нельзя: она читает старые
// коллекции `texts`/`verses`, а их снял drop-legacy-bible.ts. Поэтому правка
// данных идёт отдельно, идемпотентно, и повторный прогон ничего не меняет.
//
// После него нужен пересчёт канонических ссылок у стихов:
//   npx tsx src/scripts/recompute-bible-canon.ts --apply
//
// Запуск:
//   npx tsx src/scripts/fix-romanian-ezra.ts
//   npx tsx src/scripts/fix-romanian-ezra.ts --apply
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

const APPLY = process.argv.includes("--apply");
const EDITION = "ro-1688";

const main = async () => {
    const db = (await clientPromise).db("typikon");
    const edition = await db.collection(BIBLE_EDITIONS).findOne({ code: EDITION });
    if (!edition) { console.log(`издания «${EDITION}» нет`); process.exit(1); }

    const wrong = await db.collection(BIBLE_BOOKS).findOne({ editionId: edition._id, slug: "3-ezdry" });
    const already = await db.collection(BIBLE_BOOKS).findOne({ editionId: edition._id, slug: "2-ezdry" });

    if (already && !wrong) {
        console.log("книга уже стоит как 2-я Ездры — править нечего");
    } else if (already && wrong) {
        // Обе разом — значит данные разъехались сильнее, чем эта починка умеет.
        console.log("!! у издания есть И 2-я, И 3-я Ездры: разбирайся руками, не трогаю");
        process.exit(1);
    } else if (!wrong) {
        console.log("!! книги «3-ezdry» у румынской нет — чинить нечего, посмотри состав");
        process.exit(1);
    } else {
        const verses = await db.collection(BIBLE_VERSES).countDocuments({ bookId: wrong._id });
        console.log(`книга «${wrong.name}» (${verses} стихов): 3-ezdry -> 2-ezdry`);
        if (APPLY) {
            // Печатное имя НЕ трогаем: книга в румынской и правда названа третьей,
            // и подменить титул значило бы спрятать то, из-за чего вышла путаница.
            await db.collection(BIBLE_BOOKS).updateOne(
                { _id: wrong._id }, { $set: { slug: "2-ezdry", canonId: "2-ezdry" } });
        }
    }

    // Имя книги собрано как «<румынское> (<славянское>) - <ТИТУЛ>»: в скобках
    // стоит НЕ печатный титул, а подпись по славянскому канону, и она обязана
    // идти за canonId. Румынское «Е҆́з̾д̾ра (3)» и заглавие «КА́Р̾ТѢ А҆̀ ТРЕ́ЇА»
    // остаются как напечатано — правится только скобка.
    const book = await db.collection(BIBLE_BOOKS).findOne({ editionId: edition._id, slug: "2-ezdry" });
    if (book && (book.name as string).includes("(3-я Ездры)")) {
        const fixed = (book.name as string).replace("(3-я Ездры)", "(2-я Ездры)");
        console.log(`подпись по канону: «${book.name}» -> «${fixed}»`);
        if (APPLY) {
            await db.collection(BIBLE_BOOKS).updateOne({ _id: book._id }, { $set: { name: fixed } });
        }
    } else if (book) {
        console.log("подпись по канону уже верна — править нечего");
    }

    if (edition.canon !== "grc-lxx") {
        console.log(`канон издания: ${edition.canon ?? "не объявлен"} -> grc-lxx`);
        if (APPLY) {
            await db.collection(BIBLE_EDITIONS)
                .updateOne({ _id: edition._id }, { $set: { canon: "grc-lxx" } });
        }
    } else {
        console.log("канон уже греческий — править нечего");
    }

    console.log(APPLY
        ? "\nготово; теперь пересчитай ссылки: npx tsx src/scripts/recompute-bible-canon.ts --apply"
        : "\nПЛАН: без --apply в базу ничего не записано");
    process.exit(0);
};

main();
