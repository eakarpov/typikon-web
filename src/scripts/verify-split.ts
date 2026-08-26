// Сверяет нарезанные книги с их исходниками: ни один абзац не должен пропасть.
//
// Зачем: нарезка (split-book) создаёт из одного текста десятки, а прежний адрес
// превращает в оглавление. Ошибка в правиле заголовка или неудачный повторный прогон
// тихо теряют куски — на глаз по 3000 абзацев это не заметно. Здесь исходником служит
// поле hipSource, куда normalize-hip кладёт текст до всех преобразований.
//
// Абзац считается на месте, если он найден в одном из производных текстов либо в самом
// оглавлении. Шмуцтитулы попадают в оглавление без концевой точки, поэтому сравнение
// идёт с отброшенной концевой пунктуацией и без якорей правил.
//
// Запуск:
//   npx tsx src/scripts/verify-split.ts          // проверить
//   npx tsx src/scripts/verify-split.ts --fix    // привести books.texts в согласие с bookId
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { normalizeHip } from "@/scripts/lib/hip";

const FIX = process.argv.includes("--fix");

const paras = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
// Сравниваем по тексту, а не по разметке: якорь правила снимается, ссылка
// разворачивается обратно в то, что видит читатель.
const key = (p: string) =>
    p.replace(/^\{a\|\d+\}/, "")
        .replace(/\{t\|[^|}]*\|([^}]*)\}/g, "$1")
        .replace(/\s+/g, " ")
        .replace(/[.,;:]+$/, "")
        .trim();

const GROUPS: { source: string; derived: RegExp }[] = [
    { source: "ifika-1", derived: /^ifika-\d+$/ },
    { source: "pravila-ukazatel", derived: /^pravila-ukazatel-\d+$/ },
    ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({
        source: `pravila-svatyh-apostol-${n}`,
        derived: /^pravila-svatyh-apostol-\d+$/,
    })),
];

async function main() {
    const db = (await clientPromise).db("typikon");
    const texts = db.collection("texts");
    let bad = 0;

    for (const group of GROUPS) {
        const doc = await texts.findOne({ alias: group.source });
        if (!doc?.hipSource) {
            console.log(`${group.source.padEnd(28)} нет hipSource — сверять не с чем`);
            continue;
        }

        const derived = await texts
            .find({ alias: group.derived }, { projection: { alias: 1, content: 1 } })
            .toArray();
        const have = new Set<string>();
        const haystack: string[] = [];
        for (const d of [doc, ...derived]) {
            for (const p of paras(String(d?.content ?? ""))) {
                have.add(key(p));
                haystack.push(key(p));
            }
        }
        // Заголовок из двух абзацев (символы веры, догматы) склеивается в один,
        // поэтому исходный абзац ищется ещё и как часть более длинного.
        const joined = haystack.join("\n");

        const original = paras(normalizeHip(String(doc.hipSource)).content);
        const missing = original.filter((p) => !have.has(key(p)) && !joined.includes(key(p)));

        console.log(
            `${group.source.padEnd(28)} ${String(original.length).padStart(4)} абз., ` +
            `производных ${String(derived.length).padStart(3)} — ` +
            (missing.length ? `ПОТЕРЯНО ${missing.length}` : "всё на месте"),
        );
        for (const m of missing.slice(0, 5)) console.log(`      ⌐ ${m.slice(0, 90)}`);
        if (missing.length) bad += 1;
    }

    // Список книги строится по books.texts, поэтому текст без записи в нём невидим,
    // а запись без текста — битая ссылка. Правда в поле bookId самого текста: его
    // правит редактор при переносе, а список книги при этом отстаёт.
    const books = await db.collection("books").find({}, { projection: { name: 1, texts: 1 } }).toArray();
    for (const book of books) {
        const own = await texts.find({ bookId: book._id }, { projection: { _id: 1 } }).toArray();
        const listed = new Set((book.texts ?? []).map(String));
        const dangling = [...listed].filter((id) => !own.some((t) => String(t._id) === id));
        const orphan = own.filter((t) => !listed.has(String(t._id)));
        if (!dangling.length && !orphan.length) continue;

        console.log(
            `книга «${String(book.name).slice(0, 40)}»: битых ссылок ${dangling.length}, ` +
            `текстов мимо списка ${orphan.length}` + (FIX ? " — исправлено" : ""),
        );
        if (FIX) {
            await db.collection("books").updateOne(
                { _id: book._id },
                { $set: { texts: own.map((t) => t._id) } },
            );
        } else {
            bad += 1;
        }
    }

    console.log(bad ? `\nПРОБЛЕМНЫХ ГРУПП: ${bad}` : `\nПотерь нет, ссылки книг целы.`);
    process.exit(bad ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
