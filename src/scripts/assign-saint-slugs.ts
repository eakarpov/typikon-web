// Назначает записям каталога святых собственные адреса: `saints.slug`.
//
// ЗАЧЕМ. До сих пор страница святого жила по чужому номеру — /saints/3030, где 3030
// это идентификатор памяти в святцах dneslov.org. Пока номер чужой, мы не хозяева
// собственным адресам: их нельзя переназначить при слиянии двух памятей в одну, они
// ничего не говорят читателю, и держатся они на том, что чужой проект не станет
// перенумеровывать свою базу.
//
// АДРЕС — ОБЕЩАНИЕ. Отсюда главное правило скрипта: назначенный слуг НЕ МЕНЯЕТСЯ
// никогда. Скрипт заполняет только пустые и никогда не трогает занятые, даже если имя
// святого потом поправят. Переименование записи и смена её адреса — разные события,
// и второе делается руками, с редиректом, а не походя при пересборке.
//
// ЛАТИНИЦЕЙ, а не кириллицей в процентах: такой адрес можно продиктовать и вставить
// в письмо, не превратив его в частокол из %D0%. Транслитерация и снятие ударений
// в проекте уже написаны (slugify в @/lib/news/format, normalizeChurchSlavonic в
// @/utils/churchSlavonic) — берём их, чтобы адреса святых и адреса новостей строились
// одним правилом.
//
// ПОРЯДОК ДЕТЕРМИНИРОВАН. Одинаковые имена встречаются (соборы мучеников, тёзки), и
// второму достаётся «-2». Чтобы этот номер не переезжал с записи на запись при
// повторном запуске, идём в устойчивом порядке — по номеру памяти, а не по тому, как
// Mongo вернула документы.
//
// Запуск:
//   npx tsx src/scripts/assign-saint-slugs.ts             # план: кому какой адрес
//   npx tsx src/scripts/assign-saint-slugs.ts --write     # записать
//   ... --show 40   сколько примеров печатать
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { slugify, uniqueAlias } from "@/lib/news/format";
import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";
import { SAINT_SOURCES } from "@/lib/saintSources";

const argv = process.argv;
const WRITE = argv.includes("--write");
const SHOW = Number(argv.includes("--show") ? argv[argv.indexOf("--show") + 1] : 20) || 20;

/**
 * Адрес из имени. Ударения и церковнославянские надстрочные снимаются до
 * транслитерации: иначе «Феофа́но» распадается на «feofa-no» — комбинирующее
 * ударение не буква, и slugify честно заменяет его дефисом.
 */
export const saintSlug = (name: string): string => slugify(normalizeChurchSlavonic(name));

const main = async () => {
    const db = (await clientPromise).db("typikon");
    const saints = db.collection("saints");

    // Занятыми считаем и ПРЕЖНИЕ адреса: с них уводит редирект, и если новый святой
    // возьмёт освободившийся адрес, редирект начнёт вести не туда, а старая ссылка
    // приведёт читателя к чужой памяти. Освободить адрес можно только осознанно.
    const taken = (await saints
        .find({ $or: [{ slug: { $gt: "" } }, { previousSlugs: { $exists: true, $ne: [] } }] },
            { projection: { slug: 1, previousSlugs: 1 } })
        .toArray())
        .flatMap((s: any) => [s.slug, ...(s.previousSlugs ?? [])])
        .filter(Boolean) as string[];

    // Устойчивый порядок: сперва номер памяти числом, потом собственный _id —
    // на случай записей вовсе без внешних ключей.
    const rows = (await saints.find({ $or: [{ slug: null }, { slug: "" }, { slug: { $exists: false } }] }).toArray())
        .map((s: any) => ({
            doc: s,
            order: Number((s.externals ?? []).find((e: any) => e.source === SAINT_SOURCES.dneslov.code)?.id ?? Infinity),
        }))
        .sort((a, b) => (a.order - b.order) || String(a.doc._id).localeCompare(String(b.doc._id)));

    console.log(`без адреса: ${rows.length}, адресов уже занято: ${taken.length}`);

    const assigned: { name: string; slug: string }[] = [];
    const collided: { name: string; slug: string }[] = [];
    let fallback = 0;

    for (const { doc } of rows) {
        const base = doc.name ? saintSlug(String(doc.name)) : "";
        // Имя могло не дать ни одной латинской буквы (пустое, одни знаки препинания).
        // Адрес всё равно нужен, и лучше честно опознаваемый обломок, чем "novost".
        const seed = base && base !== "novost"
            ? base
            : `pamyat-${(doc.externals ?? [])[0]?.id ?? String(doc._id)}`;
        if (seed !== base) fallback++;

        const slug = uniqueAlias(seed, taken);
        taken.push(slug);
        const row = { name: String(doc.name ?? "(без имени)"), slug };
        assigned.push(row);
        // Столкновение считаем по факту («адрес был занят»), а не по виду адреса:
        // слуг может честно кончаться числом («...i-1218 воинов»), и по хвосту
        // тёзку от такого не отличить.
        if (slug !== seed) collided.push(row);

        if (WRITE) await saints.updateOne({ _id: doc._id }, { $set: { slug, updatedAt: new Date() } });
    }

    console.log(`\nпримеры (${Math.min(SHOW, assigned.length)} из ${assigned.length}):`);
    assigned.slice(0, SHOW).forEach((a) => console.log(`  ${a.slug.padEnd(46)} ${a.name}`));

    if (collided.length) {
        console.log(`\nадрес был занят, дополнен номером (тёзки и одноимённые соборы): ${collided.length}`);
        collided.slice(0, 10).forEach((a) => console.log(`  ${a.slug.padEnd(46)} ${a.name}`));
    }
    if (fallback) console.log(`\nимя не дало адреса, взят номер памяти: ${fallback}`);

    const longest = assigned.reduce((m, a) => (a.slug.length > m.slug.length ? a : m), { slug: "", name: "" });
    if (longest.slug) console.log(`\nсамый длинный: ${longest.slug} (${longest.slug.length}) — ${longest.name}`);

    if (!WRITE) console.log("\nэто план. Чтобы записать, добавьте --write");
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
