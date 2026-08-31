// Собственный каталог святых: коллекция `saints`.
//
// ЗАЧЕМ ОТДЕЛЬНАЯ СУЩНОСТЬ. До сих пор святой в проекте — это чужой номер, и больше
// ничего: ни строки, которая была бы наша, ни места, куда положить наше знание о нём.
// Отсюда всё остальное: имя приходится тянуть по сети при показе, публичный адрес
// /saints/{id} — чужой ключ, а сказать «эта память у нас соответствует вот этой,
// а вот здесь мы с dneslov не согласны» просто негде.
//
// Каталог переворачивает отношение: наша запись первична, а номер dneslov становится
// одним из внешних ключей (`externals`), рядом с которым встанут Викиданные, «Древо»
// и месяцесловы других поместных церквей. Пропажа или переиндексация у них перестаёт
// быть нашей аварией и становится расхождением, которое видно и которое разбирает
// человек.
//
// Реестр источников и правила поиска по внешнему ключу — в @/lib/saintSources.
// Там же объяснено, почему externals — список, а не карта: у одной записи может быть
// два ключа одного источника, и это не курьёз, а главная работа отождествления.
// Из этого же следует, что каталог НЕ обязан быть зеркалом dneslov: святой, которого
// у них нет вовсе, заводится своим импортёром и живёт с ключами только своих
// источников — или вообще без внешних ключей.
//
// ЧТО ОТКУДА. Строится из снимка `dneslov_memories` (sync-dneslov.ts) — не из сети:
// сборку каталога надо уметь повторить в любой момент, не завися от того, отвечает
// ли сегодня чужой сервер.
//
// РУЧНАЯ ПРАВКА НЕ ЗАТИРАЕТСЯ. Поле, которое человек поставил сам, перечисляется в
// `manual`, и перестройка его не трогает. Без этого правка, сделанная вечером,
// исчезала бы при ближайшей синхронизации, и каталог остался бы зеркалом чужой базы,
// а не нашей записью.
//
// СЛУГА ПОКА НЕТ. Поле `slug` заведено, но не заполняется: публичный адрес — это
// обещание, которое потом нельзя брать назад, а заголовки у dneslov сплошь и рядом
// не имена, а фразы («Пренесение мощей святителя Германа, архиепископа Казанскаго»).
// Слуги надо назначать отдельной задачей, вместе с переездом /saints/{id} и
// постоянными редиректами со старых адресов.
//
// Запуск:
//   npx tsx src/scripts/build-saints.ts            # план: что появится и что изменится
//   npx tsx src/scripts/build-saints.ts --write     # записать
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { SAINT_SOURCES, externalUrl, type SaintExternal } from "@/lib/saintSources";

const WRITE = process.argv.includes("--write");

const SOURCE = SAINT_SOURCES.dneslov.code;

type Extracted = {
    name: string | null;
    altNames: string[];
    title: string | null;
    type: string | null;
    orders: string[];
    councils: string[];
    baseYear: number | null;
    memoryDates: string[];
    imageUrl: string | null;
    roundelUrl: string | null;
    images: { url: string; thumbUrl: string | null; type?: string | null; title?: string | null }[];
};

/** Поля каталога, которые строятся из снимка (и потому могут быть перечислены в `manual`). */
const DERIVED: (keyof Extracted)[] = [
    "name", "altNames", "title", "type", "orders", "councils", "baseYear", "memoryDates",
    "imageUrl", "roundelUrl", "images",
];

const uniq = (values: (string | null | undefined)[]) =>
    [...new Set(values.filter((v): v is string => Boolean(v && v.trim())).map((v) => v.trim()))];

const extract = (doc: any): Extracted => {
    const details = doc.details ?? {};
    const memory = doc.memory ?? {};
    const events: any[] = Array.isArray(details.events) ? details.events : [];

    // Имя показываем то же, что показывал сайт: short_name — это уже готовая
    // подпись с ударениями («Феофа́но Византи́йская»), а title чаще голое имя.
    const name = details.short_name || memory.short_name || details.title || memory.title || null;

    // Прочие известные именования — из `names[].name_text`: там святцы держат варианты
    // и прозвания («Богородица» с пометкой «прозвание»), и это единственное их поле,
    // которое обещает быть ИМЕНЕМ.
    //
    // `title` сюда НЕ берём, хотя соблазн есть: иногда это голое имя («Феофания»), а
    // иногда заголовок повода — «Пресвятая Владычица наша Богородица и Приснодева Мария
    // (отдание введения во храм)». Отличить одно от другого нечем, а заголовок повода
    // в списке имён — прямая ложь. Он и так лежит отдельным полем `title`.
    //
    // ОСНОВНОЕ ИМЯ ЗДЕСЬ НЕ ВЫБИРАЕТСЯ. Снимок даёт, что даёт; если их подпись читается
    // странно («Мари́я Богоро́дица» — так никто не говорит), основное имя ставит человек
    // скриптом set-saint-name.ts, и тогда `name` попадает в `manual`, а эта выборка
    // его больше не трогает.
    const variants = Array.isArray(details.names) ? details.names.map((n: any) => n?.name_text) : [];
    const altNames = uniq([...variants, details.short_name, memory.short_name])
        .filter((v) => v !== name);

    // Чин берём человеческим кодом (orders[].name — «блгв»), а не внутренним слугом
    // («блгвж»): второй у них различает ещё и род, и для нашей полки это лишняя дробность.
    // Словарь кодов лежит у них же в db/seeds/orders.yaml — если понадобится разворачивать
    // сокращения в слова, брать его оттуда, а не сочинять свой.
    const orders = uniq(events.flatMap((e) => (Array.isArray(e.orders) ? e.orders.map((o: any) => o?.name) : [])));

    // Дни памяти в их формате «ДД.ММ» — то, ради чего каталог потом понадобится уставу.
    // Разбор в наши даты здесь не делаем: снимок хранит как есть, толкование — отдельно.
    const memoryDates = uniq(
        events.flatMap((e) => (Array.isArray(e.memoes) ? e.memoes.map((m: any) => m?.year_date) : [])),
    );

    return {
        name: name ? String(name) : null,
        altNames,
        title: details.title || memory.title || null,
        type: details.type || memory.type || null,
        orders,
        councils: uniq(String(details.council ?? "").split(",")),
        baseYear: Number.isFinite(details.base_year) ? Number(details.base_year) : null,
        memoryDates,
        imageUrl: details.image_url || null,
        roundelUrl: memory.roundel_url || null,
        // Ссылки на изображения — из отдельного прохода снимка (--images). Сами файлы
        // не наши и не у нас: зависимость от их CDN остаётся, уходит только запрос за
        // списком, который сегодня уходит из браузера каждого читателя. Поле лежит на
        // святом, а не только в снимке, потому что каталог наш: сюда же встанут
        // изображения из других источников, когда они появятся.
        images: Array.isArray(doc.images) ? doc.images : [],
    };
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const main = async () => {
    const db = (await clientPromise).db("typikon");
    const snapshots = db.collection("dneslov_memories");
    const saints = db.collection("saints");

    // Пропавшие берём тоже: запись в каталоге остаётся, но её внешний ключ надо
    // пометить протухшим — иначе исчезновение у источника заметить будет нечем.
    const docs = await snapshots.find({ status: { $in: ["ok", "gone"] } }).toArray();
    const existing = await saints.find({ "externals.source": SOURCE }).toArray();
    const byExternal = new Map<string, any>();
    existing.forEach((s: any) => {
        (s.externals ?? [])
            .filter((e: any) => e.source === SOURCE)
            .forEach((e: any) => byExternal.set(String(e.id), s));
    });

    // Только не отвечавшие: пропавшие считаются отдельно и повторный проход их не спасёт.
    const missing = await snapshots.countDocuments({ status: "error", fetchedAt: null });

    let created = 0;
    let updated = 0;
    let untouched = 0;
    let kept = 0;
    let goneMarked = 0;
    let goneUnknown = 0;

    for (const doc of docs) {
        const id = String(doc._id);
        const alive = doc.status === "ok";
        const now = new Date();
        const current = byExternal.get(id);

        // У пропавшей памяти свежих сведений нет: снимок хранит последнее, что
        // успели снять, и переписывать по нему поля незачем — они и так оттуда.
        const data = alive && doc.details ? extract(doc) : null;

        const external: SaintExternal = {
            source: SOURCE,
            id,
            slug: doc.slug ?? null,
            syncedAt: doc.fetchedAt ?? null,
            status: alive ? "ok" : "gone",
            goneAt: alive ? null : (doc.goneAt ?? now),
        };
        const withUrl = { ...external, url: externalUrl(external) };

        if (!current) {
            // Заводить запись по одному лишь номеру, о котором ничего не известно,
            // нечего: это не святой, а обломок ключа. Скажем о нём в отчёте.
            if (!data) { goneUnknown++; continue; }
            created++;
            if (WRITE) {
                await saints.insertOne({
                    slug: null,
                    ...data,
                    externals: [withUrl],
                    manual: [],
                    createdAt: now,
                    updatedAt: now,
                } as any);
            }
            continue;
        }

        if (!alive) goneMarked++;

        // Всё, чего человек не касался, приводим к снимку; остальное оставляем как есть.
        const manual: string[] = Array.isArray(current.manual) ? current.manual : [];
        const patch: Record<string, unknown> = {};
        if (data) {
            DERIVED.forEach((field) => {
                if (manual.includes(field)) return;
                if (!same(current[field], data[field])) patch[field] = data[field];
            });
        }
        if (manual.length) kept++;

        const externals = (current.externals ?? []).map((e: any) =>
            e.source === SOURCE && String(e.id) === id ? { ...e, ...withUrl } : e);
        if (!same(externals, current.externals)) patch.externals = externals;

        if (!Object.keys(patch).length) {
            untouched++;
            continue;
        }

        updated++;
        if (WRITE) {
            await saints.updateOne({ _id: current._id }, { $set: { ...patch, updatedAt: now } });
        }
    }

    console.log(`снимков в работе: ${docs.length}`);
    console.log(`  новых записей:  ${created}`);
    console.log(`  обновлений:     ${updated}`);
    console.log(`  без изменений:  ${untouched}`);
    if (kept) console.log(`  из них с ручной правкой (её не трогали): ${kept}`);
    if (goneMarked) {
        console.log(`\nисчезло у dneslov: ${goneMarked} — записи в каталоге остались, ключ помечен `
            + `протухшим (externals[].status = "gone") и требует решения человека`);
    }
    if (goneUnknown) console.log(`пропало, не успев сняться: ${goneUnknown} — заводить нечего, номер осиротел`);
    if (missing) console.log(`ни разу не снялось: ${missing} — прогоните sync-dneslov.ts ещё раз`);

    if (!WRITE) console.log("\nэто план. Чтобы записать, добавьте --write");
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
