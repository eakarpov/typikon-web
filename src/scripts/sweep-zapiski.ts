import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { expiresAt } from "@/lib/pomyannik/note";
import { sweepNotes } from "@/lib/pomyannik/zapiski";

// ЧИСТКА ПОДАННЫХ ЗАПИСОК.
//
// В записке имена третьих лиц — людей, которые этого сайта не выбирали и о нём
// не знают. После поминовения держать их не за что: у подавшего они лежат в
// помяннике, священнику они больше не нужны.
//
// СТИРАЮТСЯ ИМЕНА, А НЕ ЗАПИСЬ. Снести документ целиком было бы проще, но тогда
// у обоих пропала бы история: подавший не вспомнит, заказывал ли он сорокоуст и
// когда, священник — сколько записок принял. Ни то ни другое не требует имён.
//
// СКРИПТОМ, А НЕ TTL-ИНДЕКСОМ. В ensure-indexes прямо сказано, что удаление
// данных индексом мы не заводим: это решение хозяина базы, а не наше. Скрипту
// же можно сперва показать, что он собирается сделать.
//
// Запуск:
//   npm run pomyannik:sweep            # показать, ничего не трогая
//   npm run pomyannik:sweep -- --apply # стереть

const APPLY = process.argv.includes("--apply");

async function main() {
    const now = new Date();

    if (!APPLY) {
        const col = (await clientPromise).db("typikon-users").collection("zapiski");
        const alive = await col.find({ sweptAt: null }).toArray();
        const stale = alive.filter(doc => expiresAt(doc as any) <= now);

        console.log(`Записок с именами: ${alive.length}`);
        console.log(`Срок вышел у: ${stale.length}`);
        for (const doc of stale) {
            const why = doc.span ? `срок кончился ${doc.span.to}`
                : doc.readAt ? `прочитана ${new Date(doc.readAt).toISOString().slice(0, 10)}`
                : `подана ${new Date(doc.createdAt).toISOString().slice(0, 10)} и не прочитана`;
            console.log(`  ${doc.kind}, имён ${doc.namesCount} — ${why}`);
        }
        console.log(stale.length ? `\nНичего не стёрто. Для чистки: --apply` : "\nЧистить нечего.");
        process.exit(0);
    }

    const { swept, left } = await sweepNotes(now);
    console.log(`Стёрты имена у ${swept} записок; с именами осталось ${left}.`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
