// Точечные исправления в греческом Ветхом Завете (Свит).
//
// ЗАЧЕМ СПИСКОМ, А НЕ РАЗБОРОМ. Была попытка чинить текст по второй оцифровке того
// же издания (nathans/lxx-swete из First1KGreek, CC BY-SA 4.0) — и она показала,
// что чинить почти нечего, а сам свидетель хуже нашего текста. Сверка по 54 книгам,
// 28 379 стихов: из 9 915 расходящихся слов 5 916 — описки распознавания У НЕГО
// (κα вместо καί, πατης вместо πάσης, αργου вместо ἀγροῦ) и 125 у нас.
//
// Особенно поучительно вышло с «разорванными словами». Их насчиталось 273 — и это
// был ПРОСЧЁТ СЧЁТА: сравнение приравнивало тексты после склейки всех пробелов, а
// склейка равняла их потому, что слова слипались у свидетеля. Из 273 стихов 263
// оказались у нас исправны, ещё 10 несли квадратные скобки Свита (его помета о
// восполненном по другим рукописям: «ὁ θ[εὸς λέγων]»), которые сравнение принимало
// за разрыв слова. Настоящий случай остался ОДИН.
//
// Поэтому здесь не разбор, а список: каждое исправление названо, объяснено и видно
// в истории. Так же живут правила приведения (@/lib/bible/mappings) и стихи,
// которых издание не печатает (@/lib/bible/absent).
//
// КВАДРАТНЫЕ СКОБКИ СВИТА НЕ ТРОГАЕМ. «ὁ θ[εὸς λέγων]» — это его помета о том, что
// место восполнено по другим рукописям, а не порча набора. Она часть издания и
// должна остаться: убрав её, мы выдали бы восполненное за прочитанное.
//
// Запуск:
//   npm run bible:fix-swete              # показать, что изменится
//   npm run bible:fix-swete -- --apply   # исправить
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

const APPLY = process.argv.includes("--apply");
const EDITION = "grc-lxx-pat";

interface Correction {
    canonRef: string;
    /** Точное нынешнее чтение — правка не применится, если текст уже иной. */
    from: string;
    to: string;
    why: string;
}

export const CORRECTIONS: Correction[] = [
    {
        canonRef: "psaltir.118.127",
        from: "καὶ τὸ πάζιον",
        to: "καὶ τοπάζιον",
        why:
            "«τοπάζιον» (топаз) разорвано пробелом надвое, и обломок получил свой "
            + "гравис: «τὸ πάζιον». Соседнее «τὸ χρυσίον» подсказало артикль там, где "
            + "его нет. Читается «ὑπὲρ χρυσίον καὶ τοπάζιον».",
    },
];

/**
 * Современный знак ударения -> старый, как записано в издании.
 *
 * Текст древнегреческий и набран знаками Greek Extended: «ά» — U+1F71 (оксия).
 * В исходнике скрипта то же ударение естественно набирается U+03AC (тонос, знак
 * новогреческой монотонии). Канонически они равны — NFC переводит одно в другое, —
 * но в БАЗЕ они разные, и вписать тонос в политонический стих значит оставить
 * посреди него чужой знак. Поэтому замена приводится к письму издания.
 */
const TONOS_TO_OXIA: Record<string, string> = {
    "\u03ac": "\u1f71", "\u03ad": "\u1f73", "\u03ae": "\u1f75", "\u03af": "\u1f77",
    "\u03cc": "\u1f79", "\u03cd": "\u1f7b", "\u03ce": "\u1f7d",
    "\u0390": "\u1fd3", "\u03b0": "\u1fe3",
    "\u0386": "\u1fbb", "\u0388": "\u1fc9", "\u0389": "\u1fcb", "\u038a": "\u1fdb",
    "\u038c": "\u1ff9", "\u038e": "\u1feb", "\u038f": "\u1ffb",
};

export const toPolytonic = (text: string) => [...text.normalize("NFC")]
    .map((ch) => TONOS_TO_OXIA[ch] ?? ch)
    .join("");

/**
 * Поиск с оглядкой на нормализацию юникода. В базе греческий записан знаками
 * Greek Extended («ά» — U+1F71, оксия), а в исходнике скрипта естественно набирается
 * U+03AC (тонос). Канонически это одно и то же, побайтово — разное, и обычный
 * indexOf не находит ничего.
 *
 * Ищем по NFC, правим исходную строку ПО МЕСТУ: композиция всего стиха при этом не
 * меняется, меняется только исправляемый кусок. Если NFC переставил длину — значит
 * соответствие позиций сломано, и тогда отказываемся, а не гадаем.
 */
export const replaceNormalized = (
    content: string,
    from: string,
    to: string,
): string | null => {
    const haystack = content.normalize("NFC");
    if (haystack.length !== content.length) return null;

    const at = haystack.indexOf(from.normalize("NFC"));
    if (at < 0) return null;

    return content.slice(0, at) + to + content.slice(at + from.normalize("NFC").length);
};

const found = (content: string, needle: string) =>
    content.normalize("NFC").includes(needle.normalize("NFC"));

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const edition = await db.collection(BIBLE_EDITIONS).findOne({ code: EDITION });
    if (!edition) {
        console.error(`Издания ${EDITION} в базе нет`);
        process.exit(1);
    }

    let applied = 0;
    let already = 0;
    let missing = 0;

    for (const fix of CORRECTIONS) {
        const verse = await db.collection(BIBLE_VERSES)
            .findOne({ editionId: edition._id, canonRef: fix.canonRef });

        if (!verse) {
            console.log(`${fix.canonRef}: стиха нет в базе — пропускаю`);
            missing++;
            continue;
        }

        const content: string = verse.content || "";
        const target = toPolytonic(fix.to);

        // Побайтово, а не по NFC: правка считается стоящей, только если стих написан
        // ТЕМИ ЖЕ знаками, что и всё издание. Иначе — чиним и знаки тоже.
        if (content.includes(target)) {
            already++;
            continue;
        }

        // Ищем прежнее чтение, а если его нет — уже исправленное, но записанное не
        // теми знаками: тогда правка сама себя и долечит.
        const fixed = replaceNormalized(content, fix.from, target)
            ?? replaceNormalized(content, fix.to, target);
        if (!fixed) {
            // Текст изменился с тех пор, как правка была записана. Молча применять
            // её к другому чтению нельзя — правка описана для конкретного места.
            console.log(`${fix.canonRef}: не нашёл «${fix.from}» — текст изменился, правка не применена`);
            missing++;
            continue;
        }

        console.log(`${fix.canonRef}`);
        console.log(`  было:  ${content}`);
        console.log(`  стало: ${fixed}`);
        console.log(`  почему: ${fix.why}`);

        if (APPLY) {
            await db.collection(BIBLE_VERSES).updateOne(
                { _id: verse._id },
                { $set: { content: fixed, updatedAt: new Date() } },
            );
        }
        applied++;
    }

    console.log(`\nправок в списке: ${CORRECTIONS.length}, применимо: ${applied}, `
        + `уже стоят: ${already}, не сошлись: ${missing}`);
    if (!APPLY && applied) console.log("ПЛАН: без --apply в базу ничего не записано");
    if (APPLY && applied) console.log("Записано. Не забудь сбросить кэш: POST /api/revalidate");

    await client.close();
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
