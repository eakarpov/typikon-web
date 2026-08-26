// Превращает ссылки алфавитного указателя в живые: «Шест. л҃г» начинает вести на
// 33-е правило Трулльского собора.
//
// Откуда таблица: сокращения выписаны в самом издании, в конце указателя
// («Шест. Пра̑вила шеста́гѡ вселе́нскагѡ собо́ра»). Здесь она сведена с разделами,
// на которые Книга правил разрезана, и выверена по названиям разделов.
//
// Что делает с текстом: если у раздела есть якоря правил, ссылкой становится сам
// номер — «Шест. [л҃г]», а при перечислении каждый номер отдельно: «Карѳ. [а҃], [г҃]».
// Если нумерованных правил в разделе нет (послания, стихи, догматы), ссылкой
// становится сокращение целиком.
//
// Запуск:
//   npx tsx src/scripts/link-index-citations.ts           // что получится
//   npx tsx src/scripts/link-index-citations.ts --apply
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { buildSearchFields } from "@/lib/search";
import { revalidateContent } from "@/scripts/lib/revalidate";
import { csNumber } from "@/scripts/lib/hip";

const APPLY = process.argv.includes("--apply");

// Сокращение (все встречающиеся написания) → раздел. Порядок важен: двусловные
// формы проверяются раньше однословных, иначе «Григ. нѵ́сс.» разберётся как «Григ.».
const TABLE: { forms: string[]; alias: string; what: string }[] = [
    { forms: ["Сѷмв. вѣ́ры нік.", "С́ѷмв. вѣ́ры нік."], alias: "pravila-svatyh-apostol-8", what: "Символ веры I Собора" },
    { forms: ["Сѷмв. вѣ́ры кѡнст.", "С́ѷмв. вѣ́ры кѡнст."], alias: "pravila-svatyh-apostol-9", what: "Символ веры II Собора" },
    { forms: ["Догм. четв. соб."], alias: "pravila-svatyh-apostol-10", what: "Догмат Халкидонского" },
    { forms: ["Догм. шест. соб."], alias: "pravila-svatyh-apostol-11", what: "Догмат Трулльского" },
    { forms: ["Догм. седм. соб."], alias: "pravila-svatyh-apostol-12", what: "Догмат Никейского II" },
    { forms: ["Карѳ. къ келест."], alias: "pravila-svatyh-apostol-26", what: "послание к Келестину" },
    { forms: ["Григ. нѵ́сс."], alias: "pravila-svatyh-apostol-34", what: "Григорий Нисский" },
    { forms: ["Григ. неокес.", "Григ. неок."], alias: "pravila-svatyh-apostol-29", what: "Григорий Неокесарийский" },
    { forms: ["Григ. бг҃осл."], alias: "pravila-svatyh-apostol-35", what: "Григорий Богослов" },
    { forms: ["Петр. а҆леѯ."], alias: "pravila-svatyh-apostol-28", what: "Пётр Александрийский" },
    { forms: ["А҆пост."], alias: "pravila-svatyh-apostol-13", what: "правила апостольские" },
    { forms: ["Перв."], alias: "pravila-svatyh-apostol-14", what: "Никейский I" },
    { forms: ["Втор."], alias: "pravila-svatyh-apostol-15", what: "Константинопольский I" },
    { forms: ["Трет."], alias: "pravila-svatyh-apostol-16", what: "Ефесский" },
    { forms: ["Четв."], alias: "pravila-svatyh-apostol-17", what: "Халкидонский" },
    { forms: ["Шест."], alias: "pravila-svatyh-apostol-18", what: "Трулльский" },
    { forms: ["Седм."], alias: "pravila-svatyh-apostol-19", what: "Никейский II" },
    { forms: ["А҆гкѵ́р.", "А҆гк."], alias: "pravila-svatyh-apostol-20", what: "Анкирский" },
    { forms: ["Неок."], alias: "pravila-svatyh-apostol-21", what: "Неокесарийский" },
    { forms: ["Га́нгр."], alias: "pravila-svatyh-apostol-22", what: "Гангрский" },
    { forms: ["А҆нт."], alias: "pravila-svatyh-apostol-23", what: "Антиохийский" },
    { forms: ["Лаод."], alias: "pravila-svatyh-apostol-24", what: "Лаодикийский" },
    { forms: ["Сард."], alias: "pravila-svatyh-apostol-2", what: "Сардикийский" },
    { forms: ["Карѳ."], alias: "pravila-svatyh-apostol-25", what: "Карфагенский" },
    { forms: ["Кѡ́нст."], alias: "pravila-svatyh-apostol-4", what: "Константинопольский 394 г." },
    { forms: ["Двꙋкр."], alias: "pravila-svatyh-apostol-5", what: "Двукратный" },
    { forms: ["Премꙋ́др."], alias: "pravila-svatyh-apostol-6", what: "в храме Премудрости" },
    { forms: ["Діонѵ́с."], alias: "pravila-svatyh-apostol-27", what: "Дионисий Александрийский" },
    { forms: ["А҆ѳан."], alias: "pravila-svatyh-apostol-30", what: "Афанасий Великий" },
    { forms: ["Васі́л."], alias: "pravila-svatyh-apostol-33", what: "Василий Великий" },
    { forms: ["А҆мф."], alias: "pravila-svatyh-apostol-36", what: "Амфилохий Иконийский" },
    { forms: ["Тімоѳ."], alias: "pravila-svatyh-apostol-37", what: "Тимофей Александрийский" },
    { forms: ["Ѳео́ф.", "Fео́ф."], alias: "pravila-svatyh-apostol-38", what: "Феофил Александрийский" },
    { forms: ["Ќѷрі́л.", "Кѷрі́л."], alias: "pravila-svatyh-apostol-39", what: "Кирилл Александрийский" },
    { forms: ["Геннад."], alias: "pravila-svatyh-apostol-40", what: "Геннадий Константинопольский" },
    { forms: ["Тара́с."], alias: "pravila-svatyh-apostol-41", what: "Тарасий Константинопольский" },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Церковнославянское число узнаётся по титлу.
const NUMERAL = "[^\\s,.;:()«»\\[\\]{}|]*҃[^\\s,.;:()«»\\[\\]{}|]*";
const LIST = `${NUMERAL}(?:\\s*,\\s*${NUMERAL})*`;

// Колонтитулы ({p|с. в҃}) содержат числа и не должны попасть в перечисление.
const MASK_OPEN = "\uE010";
const mask = (s: string, keep: string[]) =>
    s.replace(/\{[pta]\|[^}]*\}/g, (m) => { keep.push(m); return `${MASK_OPEN}${keep.length - 1}${MASK_OPEN}`; });
// Разворачивать приходится в несколько проходов: спрятанное могло попасть внутрь
// того, что спрятали позже.
const unmask = (s: string, keep: string[]) => {
    const re = new RegExp(`${MASK_OPEN}(\\d+)${MASK_OPEN}`, "g");
    let out = s;
    while (re.test(out)) out = out.replace(re, (_m, i) => keep[Number(i)]);
    return out;
};

type Stats = { linked: number; sectionOnly: number; unparsed: string[] };

export const linkCitations = (
    content: string,
    anchored: Map<string, number>,
    stats: Stats,
): string => {
    const keep: string[] = [];
    let s = mask(content, keep);

    for (const entry of TABLE) {
        for (const form of entry.forms) {
            const re = new RegExp(`(^|[^\\p{L}])(${escape(form)})(\\s*)(${LIST})?`, "gu");
            s = s.replace(re, (whole, before, abbr, gap, list) => {
                const max = anchored.get(entry.alias) ?? 0;
                if (!list || !max) {
                    // Ссылаться некуда точнее раздела — ссылкой становится сокращение.
                    stats.sectionOnly += 1;
                    return `${before}{t|${entry.alias}|${abbr}}${gap}${list ?? ""}`;
                }
                const linked = list.replace(new RegExp(NUMERAL, "gu"), (num: string) => {
                    const n = csNumber(num);
                    if (n === null || n < 1 || n > max) {
                        stats.unparsed.push(`${form} ${num} (в разделе ${max} единиц)`);
                        return num;
                    }
                    stats.linked += 1;
                    return `{t|${entry.alias}#p-${n}|${num}}`;
                });
                return `${before}${abbr}${gap}${linked}`;
            });
        }
        // Готовые ссылки прячем сразу: иначе более короткое сокращение сработает
        // внутри уже собранной ссылки — «Карѳ.» внутри «Карѳ. къ келест.».
        s = mask(s, keep);
    }
    return unmask(s, keep);
};

async function main() {
    const client = await clientPromise;
    const db = client.db("typikon");
    const texts = db.collection("texts");

    // Сколько нумерованных единиц в каждом разделе — по ним проверяем номер ссылки.
    const anchored = new Map<string, number>();
    for (const entry of TABLE) {
        if (anchored.has(entry.alias)) continue;
        const doc = await texts.findOne({ alias: entry.alias }, { projection: { content: 1, name: 1 } });
        if (!doc) {
            console.log(`ТАБЛИЦА: раздела ${entry.alias} нет в базе`);
            continue;
        }
        const nums = [...String(doc.content).matchAll(/\{a\|(\d+)\}/g)].map((m) => Number(m[1]));
        anchored.set(entry.alias, nums.length ? Math.max(...nums) : 0);
    }

    const docs = await texts.find({ alias: /^pravila-ukazatel-\d+$/ }, { projection: { alias: 1, name: 1, content: 1 } })
        .sort({ bookIndex: 1 }).toArray();

    const total: Stats = { linked: 0, sectionOnly: 0, unparsed: [] };
    let changed = 0;

    for (const doc of docs) {
        const before = String(doc.content);
        if (before.includes("{t|")) {
            console.log(`${doc.alias}: ссылки уже проставлены, пропуск`);
            continue;
        }
        const stats: Stats = { linked: 0, sectionOnly: 0, unparsed: [] };
        const after = linkCitations(before, anchored, stats);
        total.linked += stats.linked;
        total.sectionOnly += stats.sectionOnly;
        total.unparsed.push(...stats.unparsed);

        console.log(
            `${String(doc.name).padEnd(18)} ссылок на правило ${String(stats.linked).padStart(4)}, ` +
            `на раздел ${String(stats.sectionOnly).padStart(3)}` +
            (stats.unparsed.length ? `, НЕ РАЗОБРАНО ${stats.unparsed.length}` : ""),
        );

        if (APPLY && after !== before) {
            await texts.updateOne(
                { _id: doc._id },
                { $set: { content: after, ...buildSearchFields({ ...doc, content: after } as any), updatedAt: new Date() } },
            );
            changed += 1;
        }
    }

    console.log(`\nИтого: ${total.linked} ссылок на конкретное правило, ${total.sectionOnly} на раздел целиком`);
    if (total.unparsed.length) {
        console.log(`\nНЕ РАЗОБРАНО (${total.unparsed.length}):`);
        const seen = new Map<string, number>();
        for (const u of total.unparsed) seen.set(u, (seen.get(u) ?? 0) + 1);
        for (const [u, n] of [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
            console.log(`   ×${n} ${u}`);
        }
    }

    if (!APPLY) {
        console.log(`\nХолостой прогон, база не тронута. Записать: npx tsx src/scripts/link-index-citations.ts --apply`);
        process.exit(0);
    }
    console.log(`\nОбновлено разделов: ${changed}`);
    await revalidateContent();
    process.exit(0);
}

if (process.argv[1]?.endsWith("link-index-citations.ts")) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
