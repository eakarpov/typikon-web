// Меняет адрес страницы святого руками.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ СКРИПТ. Слуги раздаёт assign-saint-slugs.ts, и он назначенное не
// трогает никогда: адрес — обещание, и переписывать его при каждой пересборке нельзя.
// Но иногда адрес всё же надо сменить — имя из святцев пришло неудачным, две памяти
// свели в одну, поправили опечатку. Это решение человека, и делаться оно должно
// осознанно и с последствиями, а не правкой поля в базе.
//
// ЧТО ДЕЛАЕТ, ЧЕГО НЕ СДЕЛАЛА БЫ ручная правка:
//   * прежний адрес уходит в `previousSlugs`, и страница продолжает по нему
//     открываться, уводя постоянным редиректом (см. @/lib/saints);
//   * прежний адрес остаётся ЗАНЯТЫМ — assign-saint-slugs.ts его больше никому не
//     отдаст, иначе старая ссылка привела бы читателя к чужой памяти;
//   * новый адрес проверяется на занятость по обоим спискам, а не только по текущим.
//
// Запуск:
//   npx tsx src/scripts/set-saint-slug.ts --saint <слуг|номер> --slug <новый>
//   ... --write   (без него только показывает, что будет)
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { byExternal, SAINT_SOURCES } from "@/lib/saintSources";
import { revalidateTags } from "@/scripts/lib/revalidate";
import { CacheTag } from "@/lib/cache";

const argv = process.argv;
const value = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const WRITE = argv.includes("--write");

const SAINT = value("--saint");
const SLUG = value("--slug");

const main = async () => {
    if (!SAINT || !SLUG) {
        console.error("нужны --saint <текущий слуг или номер святцев> и --slug <новый адрес>");
        process.exit(1);
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(SLUG)) {
        console.error(`«${SLUG}» не годится в адрес: строчная латиница, цифры и дефис`);
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
    if (saint.slug === SLUG) {
        console.log(`у «${saint.name}» уже адрес ${SLUG} — менять нечего`);
        process.exit(0);
    }

    // Занятость проверяем и по прежним адресам: занять чужой отставленный адрес
    // значит увести его редирект не туда.
    const clash: any = await saints.findOne({
        _id: { $ne: saint._id },
        $or: [{ slug: SLUG }, { previousSlugs: SLUG }],
    });
    if (clash) {
        console.error(`адрес ${SLUG} занят: «${clash.name}» (${clash.slug === SLUG ? "текущий" : "прежний"})`);
        process.exit(1);
    }

    const previous: string[] = Array.isArray(saint.previousSlugs) ? saint.previousSlugs : [];
    const keep = saint.slug ? [...new Set([...previous, saint.slug])] : previous;

    console.log(`«${saint.name}»`);
    console.log(`  было:  ${saint.slug ?? "(без адреса)"}`);
    console.log(`  стало: ${SLUG}`);
    console.log(`  прежние адреса (уводят редиректом): ${keep.join(", ") || "нет"}`);

    if (!WRITE) {
        console.log("\nэто план. Чтобы записать, добавьте --write");
        process.exit(0);
    }

    await saints.updateOne(
        { _id: saint._id },
        { $set: { slug: SLUG, previousSlugs: keep, updatedAt: new Date() } },
    );
    console.log("\nзаписано");

    // Иначе указатель и страницы до часа отдают прежний адрес: правка идёт мимо
    // приложения, и его кэш о ней не знает.
    await revalidateTags([CacheTag.SAINTS, CacheTag.TEXTS]);
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
