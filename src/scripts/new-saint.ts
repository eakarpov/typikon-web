// Заводит в каталог святого, которого нет ни в святцах dneslov, ни в нашем
// корпусе: запись наша, поставлена руками, без внешних ключей.
//
// ПОЧЕМУ ТАК МОЖНО. Каталог наш, а не зеркало чужой базы (см. шапку
// build-saints.ts). Сборка из снимка трогает только записи с
// `externals.source = "dneslov"` и запись без внешних ключей просто не видит.
// Чужой номер нужен лишь там, где с чужой записью надо сверяться; здесь
// сверять не с чем, и подделывать внешний ключ (как и брать чужой разбор)
// не за чем.
//
// ЧТО СТАВИТ ЧЕЛОВЕК. Имя, прозвания, сан и дни памяти — «ДД.ММ» по СТАРОМУ
// стилю, как в святцах и Минее (Серафим Саровский у нас `02.01`, а не `15.01`).
// Всё поставленное перечисляется в `manual`, и пересборка его не тронет.
//
// ИСТОЧНИК. Запись ручная, поэтому в `provenance` кладётся одна запись с
// `table: "manual"`: это не ключ корпуса, а пометка «поставлено руками» со
// ссылкой на то, откуда взяты сведения. Код, который ищет корпусные таблицы
// (`memories`, `sobor_lica`), её не видит. Пропускать поле нельзя: без него
// запись не отличить от сиротского обломка чужого ключа.
//
// АДРЕС. Слуг назначается здесь же, из имени (тем же правилом, что
// assign-saint-slugs.ts) и больше не меняется. Страница святого живёт по нему.
//
// ПОВТОР управляется `--into`: если запись с таким слугом уже есть, скрипт
// откажется, пока не попросят дополнить её явно.
//
// Запуск:
//   npm run saints:new -- --name "Тихон (Беллавин)" --dates 25.03,26.09 \
//       --alt "Тихон, Патриарх Московский,Тихон Московский" --orders свт \
//       --year 1925 --text "прославлен 26.09.1989" --url https://… [--write]
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { uniqueAlias } from "@/lib/news/format";
import { saintSlug } from "@/lib/saintSlug";

const argv = process.argv;
const WRITE = argv.includes("--write");

const arg = (name: string, fallback?: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const list = (raw?: string) =>
    [...new Set((raw ?? "").split(",").map((v) => v.trim()).filter(Boolean))];

/** Поля каталога, которые здесь ставит человек и которые нельзя затирать. */
const MANUAL_FIELDS = [
    "name", "altNames", "title", "type", "orders", "councils", "baseYear", "memoryDates",
    "imageUrl", "roundelUrl", "images",
];

const main = async () => {
    const name = arg("name")?.trim();
    if (!name) { console.error("нужно --name: имя святого в каталоге"); process.exit(1); }

    const dates = list(arg("dates"));
    const wrong = dates.filter((d) => !/^\d{2}\.\d{2}$/.test(d));
    if (wrong.length) { console.error(`дни памяти — «ДД.ММ» по старому стилю, не понял: ${wrong.join(", ")}`); process.exit(1); }

    const db = (await clientPromise).db("typikon");
    const saints = db.collection("saints");

    const taken = new Set((await saints
        .find({ $or: [{ slug: { $gt: "" } }, { previousSlugs: { $exists: true, $ne: [] } }] },
            { projection: { slug: 1, previousSlugs: 1 } })
        .toArray())
        .flatMap((s: any) => [s.slug, ...(s.previousSlugs ?? [])])
        .filter(Boolean) as string[]);

    const slug = uniqueAlias(saintSlug(name) || "svyatoi", taken);
    const existing = await saints.findOne({ $or: [{ slug }, { name }] });

    const now = new Date();
    const record = {
        slug,
        name,
        altNames: list(arg("alt")).filter((v) => v !== name),
        title: arg("title")?.trim() || null,
        type: arg("type")?.trim() || "Identity",
        orders: list(arg("orders")),
        councils: list(arg("councils")),
        baseYear: Number(arg("year")) || null,
        memoryDates: dates,
        imageUrl: null,
        roundelUrl: null,
        images: [],
        externals: [],   // ни одного внешнего ключа: сверять не с чем
        previousUris: [],
        provenance: [{
            table: "manual",
            id: slug,
            edition: "руками",
            chin: null,
            office: null,
            text: arg("text")?.trim() || null,
            url: arg("url")?.trim() || null,
        }],
        manual: MANUAL_FIELDS,
        createdAt: now,
        updatedAt: now,
    };

    console.log(`${record.name}  →  /saints/${slug}`);
    console.log(`  дни памяти: ${record.memoryDates.join(", ") || "— (по старому стилю)"}`);
    console.log(`  прозвания:  ${record.altNames.join(" · ") || "—"}`);
    console.log(`  сан:        ${record.orders.join(", ") || "—"}; год: ${record.baseYear ?? "—"}`);
    console.log(`  источник:   ${record.provenance[0].url ?? "—"} ${record.provenance[0].text ?? ""}`);

    if (existing) {
        console.log(`\nтакая запись уже есть: ${existing.name} (${existing.slug ?? "без слуга"}) — `
            + `правьте её штатными set-saint-name.ts / set-saint-slug.ts`);
        process.exit(1);
    }
    if (!WRITE) {
        console.log("\nэто план. Чтобы записать, добавьте --write");
        process.exit(0);
    }

    const res = await saints.insertOne(record as any);
    console.log(`\nзаписано: ${res.insertedId}`);
    console.log("кэш святых переберётся сам или при старте сайта");
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
