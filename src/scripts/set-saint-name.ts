// Ставит основное имя святого и добавляет альтернативные — руками.
//
// ЗАЧЕМ. Основное имя приходит из снимка святцев, а там это `short_name` — подпись,
// собранная по их правилам. Иногда она читается странно: «Мари́я Богоро́дица» — так
// никто не говорит. Выбор того, как памятью называют по-русски, — решение человека,
// и оно должно где-то жить и переживать синхронизацию.
//
// ЧТО ЗНАЧИТ «РУКАМИ». Тронутые поля перечисляются в `saints.manual`, и build-saints.ts
// их больше не переписывает. Цена честная и её надо понимать: с этого момента новые
// варианты имени, появившиеся у святцев, к этой записи сами не приедут. Для полусотни
// памятей, которые мы правим осознанно, это верный размен; списком по всему каталогу
// так делать не надо.
//
// ПРЕЖНЕЕ ИМЯ НЕ ТЕРЯЕТСЯ: меняя основное, кладём старое в альтернативные. Оно остаётся
// верным именованием, просто перестаёт быть тем, которым подписываем.
//
// Запуск:
//   npx tsx src/scripts/set-saint-name.ts --saint bogorodica \
//       --name "Богородица" --alt "Богоматерь,Дева Мария" --write
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { byExternal, SAINT_SOURCES } from "@/lib/saintSources";
import { revalidateTags } from "@/scripts/lib/revalidate";
import { CacheTag } from "@/lib/cache";

const argv = process.argv;
const value = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const WRITE = argv.includes("--write");

const SAINT = value("--saint");
const NAME = value("--name");
const ALT = (value("--alt") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const DROP = (value("--drop-alt") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const main = async () => {
    if (!SAINT || (!NAME && !ALT.length && !DROP.length)) {
        console.error("нужен --saint <слуг или номер> и хотя бы одно из --name / --alt / --drop-alt");
        process.exit(1);
    }

    const saints = (await clientPromise).db("typikon").collection("saints");
    const saint: any = (await saints.findOne({ slug: SAINT }))
        ?? (await saints.findOne({ previousSlugs: SAINT }))
        ?? (/^\d+$/.test(SAINT) ? await saints.findOne(byExternal(SAINT_SOURCES.dneslov.code, SAINT)) : null);

    if (!saint) {
        console.error(`не нашёл святого по «${SAINT}»`);
        process.exit(1);
    }

    const wasName: string | null = saint.name ?? null;
    const name = NAME ?? wasName;

    // Прежнее основное имя переезжает в альтернативные, а то, что стало основным,
    // из альтернативных убирается: одно и то же имя не должно стоять в обоих списках.
    const alt = [...new Set([...(saint.altNames ?? []), ...ALT, ...(NAME && wasName ? [wasName] : [])])]
        .filter((v) => v && v !== name && !DROP.includes(v));

    const manual = [...new Set([
        ...(Array.isArray(saint.manual) ? saint.manual : []),
        ...(NAME ? ["name"] : []),
        ...(ALT.length || DROP.length || NAME ? ["altNames"] : []),
    ])];

    console.log(`«${wasName ?? "(без имени)"}»  ->  «${name}»`);
    console.log(`  альтернативные: ${alt.join(" · ") || "нет"}`);
    console.log(`  снимок больше не обновляет: ${manual.join(", ")}`);

    if (!WRITE) {
        console.log("\nэто план. Чтобы записать, добавьте --write");
        process.exit(0);
    }

    await saints.updateOne(
        { _id: saint._id },
        { $set: { name, altNames: alt, manual, updatedAt: new Date() } },
    );
    console.log("\nзаписано");
    await revalidateTags([CacheTag.SAINTS, CacheTag.TEXTS]);
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
