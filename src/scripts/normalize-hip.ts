// Приводит тексты, залитые с orthlib.ru в сыром формате HIP, к тому виду, в котором
// живёт остальной корпус: церковнославянский юникод плюс наша разметка.
//
// Кого чинит: «Ифика Иерополитика» и семь текстов «Книги правил». Это единственные
// тексты базы с сырой разметкой orthlib — `<::слав>` встречается только в них и в
// алфавитном указателе, который разбирается отдельно.
//
// Что делает, по классам (каждый считается и показывается в холостом прогоне):
//   шапка       — служебный заголовок OCR и переключатели <::лат>/<::рꙋс>/<::слав>
//   вставки     — <-> в тире, <о_> в восстановленную издателем букву
//   проценты    — %[…%] / %(…%) снимает обёртку, %t в табуляцию
//   строки      — снимает // (разрывы строк набора) и разворачивает жёсткие переносы
//   буквы       — латинские подстановки в кириллицу: i→і, I→І, f→ѳ, W→Ѡ, S→Ѕ, V→Ѵ, JЬ→Ѣ, Jа→Ꙗ
//   числа       — # в знак тысячи, _пс в ѱ, _кс в ѯ, прочий _ перед буквой снимается
//   титла       — снимает паразитное титло перед ударением (24 157 штук в Ифике; такой
//                 пары нет ни в одном из 296 чистых церковнославянских текстов корпуса)
//   ударения    — ` в варию, ^ в камору, V" в Ѷ
//   сноски      — {текст} в наш {N} плюс массив footnotes; {комм.} не трогается,
//                 это редакционный комментарий синодального издания, а не сноска
//   колонтитулы — (л. а҃) / (с. в҃) в {p|л. а҃}: привязка к страницам печатного издания
//                 сохраняется, из потока чтения уходит
//   NFC         — прекомпозиция (ѝ, ѐ, ѷ), как в остальном корпусе
//
// Исходник сохраняется в поле hipSource: замены необратимы, а сноски после них из
// текста уже не восстановить. Повторный запуск по тому же тексту пропускается, если
// hipSource уже есть; --force прогоняет заново от сохранённого исходника.
//
// Запуск:
//   npx tsx src/scripts/normalize-hip.ts                    // что изменится
//   npx tsx src/scripts/normalize-hip.ts --text=ifika-1     // только один текст
//   npx tsx src/scripts/normalize-hip.ts --apply            // записать
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { buildSearchFields } from "@/lib/search";
import { revalidateContent } from "@/scripts/lib/revalidate";
import { normalizeHip, bump, type Stats } from "@/scripts/lib/hip";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const ONLY = process.argv.find((a) => a.startsWith("--text="))?.slice("--text=".length);

const TARGETS = [
    "ifika-1",
    // Оглавление алфавитного указателя к Книге правил (лежал под книгой «Алфавит Духовный»).
    "pravila-ukazatel",
    "pravila-svatyh-apostol-1",
    "pravila-svatyh-apostol-2",
    "pravila-svatyh-apostol-3",
    "pravila-svatyh-apostol-4",
    "pravila-svatyh-apostol-5",
    "pravila-svatyh-apostol-6",
    "pravila-svatyh-apostol-7",
];

// То, чего после нормализации остаться не должно: показываем, а не молчим.
const LEFTOVERS: [string, RegExp][] = [
    ["латиница", /[A-Za-z]/g],
    ["backtick", /`/g],
    ["крышка", /\^/g],
    ["решётка", /#/g],
    ["процент", /%/g],
    ["угловые скобки", /[<>]/g],
    ["двойной слэш", /\/\//g],
    ["подчёркивание", /_/g],
    ["слэш и собака", /[\\@]/g],
    ["метка [?]", /\[\?\]/g],
];

const line = (rows: [string, number][]) => rows.map(([k, v]) => `${k} ${v}`).join(", ");

async function main() {
    const client = await clientPromise;
    const texts = client.db("typikon").collection("texts");
    const aliases = ONLY ? [ONLY] : TARGETS;

    const total: Stats = {};
    const touched: string[] = [];

    for (const alias of aliases) {
        const doc = await texts.findOne({ alias });
        if (!doc) {
            console.log(`\n${alias}: не найден`);
            continue;
        }
        if (doc.hipSource && !FORCE) {
            console.log(`\n${alias}: уже нормализован (есть hipSource), пропуск. --force — прогнать заново от исходника.`);
            continue;
        }

        const raw: string = doc.hipSource ?? doc.content ?? "";
        const { content, footnotes, dropped, stats } = normalizeHip(raw);

        console.log(`\n=== ${alias} — ${doc.name ?? ""}`);
        console.log(
            `    ${raw.length} знаков -> ${content.length}; сносок ${footnotes.length}` +
            (doc.footnotes?.length ? ` (в базе уже ${doc.footnotes.length}, будут заменены)` : ""),
        );

        const rows = Object.entries(stats).sort((a, b) => b[1] - a[1]) as [string, number][];
        console.log(`    ${line(rows)}`);
        for (const [k, v] of rows) bump(total, k, v);

        // Проверяем на остатки уже без нашей собственной разметки, иначе {p|…}
        // отчитается как непочищенная латиница.
        const bare = content.replace(/\{p\|[^}]*\}/g, "").replace(/\{\d+\}/g, "");
        const left = LEFTOVERS
            .map(([name, re]) => [name, (bare.match(re) ?? []).length] as [string, number])
            .filter(([, n]) => n);
        if (left.length) console.log(`    ОСТАЛОСЬ: ${line(left)}`);
        if (dropped.length) {
            console.log(`    удалена обвязка публикатора: ${dropped.map((d) => `«${d.slice(0, 70)}»`).join("; ")}`);
        }

        // Обратный слэш в Ифике размечает выносные буквы и глоссы, но однозначно
        // прочитать его по одному тексту нельзя — не угадываем, показываем места.
        const manual = [...bare.matchAll(/.{20}(?:[\\@]|\[\?\]).{20}/g)].map((m) => m[0].replace(/\n/g, " "));
        if (manual.length) {
            console.log(`    требует глаз (${manual.length}):`);
            for (const m of manual.slice(0, 40)) console.log(`      …${m}…`);
        }

        console.log(`    начало: ${content.slice(0, 150).replace(/\n/g, " | ")}`);
        if (footnotes.length) {
            console.log(`    сноски: ${footnotes.slice(0, 3).map((f) => `«${f.slice(0, 36)}»`).join(", ")}`);
        }

        if (APPLY) {
            await texts.updateOne(
                { _id: doc._id },
                {
                    $set: {
                        content,
                        footnotes,
                        hipSource: raw,
                        ...buildSearchFields({ ...doc, content } as any),
                        updatedAt: new Date(),
                    },
                },
            );
            touched.push(alias);
        }
    }

    console.log(`\nИтого: ${line(Object.entries(total).sort((a, b) => b[1] - a[1]) as [string, number][])}`);

    if (!APPLY) {
        console.log(`\nХолостой прогон, база не тронута. Записать: npx tsx src/scripts/normalize-hip.ts --apply`);
        process.exit(0);
    }

    console.log(`\nЗаписано текстов: ${touched.length}`);
    await revalidateContent();
    process.exit(0);
}

// Скрипт заодно экспортирует normalizeHip для split-book, поэтому сам себя запускает
// только когда его позвали напрямую.
if (process.argv[1]?.endsWith("normalize-hip.ts")) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
