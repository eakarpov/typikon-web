// Снимок святцев dneslov.org в нашу базу: коллекция `dneslov_memories`.
//
// ЗАЧЕМ. Сегодня идентичности святого в проекте нет — её роль играет чужой номер
// (texts.dneslovId, texts.mentionIds, memory_saint_links, akathist_saint_links,
// nobles.dneslovId), а имя приходит по сети в момент показа страницы. Из этого
// следуют три беды, и все три уже описаны в коде:
//
//   * сервис нестабилен — неполная цепочка сертификатов, схема то одна то другая,
//     замер 2026-08-27 дал 39 секунд на страницу указателя (см. src/lib/dneslov.ts);
//   * когда он молчит, читатель видит «Память №3030» вместо имени;
//   * если у них запись сольют, разделят или перенумеруют, наши связи поедут молча.
//
// Снимок закрывает все три: сеть остаётся только здесь, в скрипте, который гоняют
// по расписанию, а страницы читают из базы. И, что важнее, появляется место, где
// видно расхождение: если память исчезла у них, это событие, о котором скажут
// человеку, а не тишина.
//
// СНИМОК — НЕ КАТАЛОГ. Здесь лежит ровно то, что ответил dneslov, без правки и без
// толкования: сырой JSON и дата. Наши собственные сведения о святом — в коллекции
// `saints`, её строит build-saints.ts поверх этого снимка. Разделение нужно затем,
// чтобы синхронизация могла безбоязненно перезаписывать снимок целиком, не трогая
// ручную работу.
//
// ЧТО СНИМАЕМ. Только те номера, которыми мы уже пользуемся: тексты, подтверждённые
// связи и родословная. Кандидатов на ревью здесь нет — им хватает поискового кэша
// `dneslov_names` (см. scripts/lib/saintMatch.ts).
//
// ПРАВА. LICENSE-CORPUS.md сейчас говорит, что сведения о святых «приходят по их API
// при показе страницы, в корпусе не хранятся». С этим снимком это перестаёт быть
// правдой, и формулировку надо поправить. У dneslov.org открыт код (GPLv2), но условия
// на сами данные нигде не заявлены — прежде чем показывать снимок читателям, стоит
// спросить их напрямую. Сам по себе снимок — тот же кэш, что и `dneslov_names`,
// только долгоживущий.
//
// Запуск:
//   npx tsx src/scripts/sync-dneslov.ts                  # план: сколько снимать
//   npx tsx src/scripts/sync-dneslov.ts --write          # снять устаревшее и новое
//   npx tsx src/scripts/sync-dneslov.ts --write --force  # пересnять всё
//   npx tsx src/scripts/sync-dneslov.ts --write --images  # только ссылки на картинки
//   ... --only 3030,7360   ... --limit 50   ... --max-age 7   ... --retries 3
//
// Первый полный обход прогоняют НЕСКОЛЬКО РАЗ подряд: каждый проход берёт только то,
// что ещё не снято, и с каждым разом остаётся всё меньше зависших.
import "@/scripts/lib/env";
import Database from "better-sqlite3";
import clientPromise from "@/lib/mongodb";
import { fetchMemoryImages, fetchMemorySnapshot } from "@/scripts/lib/dneslov";

const argv = process.argv;
const flag = (name: string) => argv.includes(name);
const value = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);

const WRITE = flag("--write");
// Отдельный проход только за списками изображений: подробности памятей уже сняты,
// и ради картинок незачем переснимать их заново двумя запросами на каждую.
const IMAGES = flag("--images");
const FORCE = flag("--force");
const LIMIT = Number(value("--limit") ?? 0) || 0;
const ONLY = (value("--only") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

// Месяц: имя святого в святцах не меняется годами, а каждый проход — это сотни
// запросов к чужому серверу. Чаще ходить незачем, реже — рискуем не заметить,
// что запись у них исчезла.
const MAX_AGE_DAYS = Number(value("--max-age") ?? 30);

// Восемь потоков — столько же, сколько берёт страница указателя (src/lib/dneslov.ts),
// то есть не больше того, что этот сервис от нас и так видит.
//
// Но не всегда восемь: замер 2026-08-31 на проходе за картинками показал, как доля
// удач ползёт вниз по ходу обхода (93% на подробностях -> 41% на картинках к семисотой
// памяти). Похоже, мы придавливаем их сами. Для догона отставших вернее сбавить темп
// и добавить повторов, чем долбить сильнее: --concurrency 3 --retries 3.
const CONCURRENCY = Number(value("--concurrency") ?? 8);

// ПОЧЕМУ ПЕРВЫЙ ПРОХОД БЕЗ ПОВТОРОВ. Замер 2026-08-31: здоровый ответ приходит за
// 0.6-1.8 с, но примерно каждый десятый запрос виснет до упора (77 с при ручной
// проверке, тот же случай, что записан в src/lib/dneslov.ts). Повторять такой запрос
// втрое дороже, чем оставить его следующему проходу: скрипт и так берёт только то,
// что ещё не снято, поэтому «прогнать три раза» быстрее, чем «упорствовать на каждом».
const RETRIES = Number(value("--retries") ?? 1);

// Здоровый ответ укладывается в две секунды; всё, что дольше десяти, — уже зависание,
// и ждать его незачем: этот номер возьмёт следующий проход.
const TIMEOUT_MS = Number(value("--timeout") ?? 10000);

/** Все номера dneslov, которыми проект уже пользуется. */
const collectIds = async (): Promise<Map<string, string[]>> => {
    const db = (await clientPromise).db("typikon");
    const where = new Map<string, string[]>();

    // Ключи в базе набирали руками, и один из них приехал с хвостовым пробелом
    // ("8602 "): без обрезки это второй номер той же памяти, второй снимок и вторая
    // запись в каталоге. Обрезаем здесь, а грязный исходник называем в отчёте —
    // чинить его надо там, откуда он взялся, а не молча подменять при каждом обходе.
    const dirty = new Set<string>();
    const add = (id: unknown, source: string) => {
        if (id === null || id === undefined) return;
        const raw = String(id);
        const key = raw.trim();
        if (!key) return;
        if (key !== raw) dirty.add(`${source}: ${JSON.stringify(raw)}`);
        where.set(key, [...new Set([...(where.get(key) ?? []), source])]);
    };

    (await db.collection("texts").distinct("dneslovId")).forEach((v) => add(v, "texts.dneslovId"));
    (await db.collection("texts").distinct("mentionIds")).forEach((v) => add(v, "texts.mentionIds"));
    (await db.collection("memory_saint_links").distinct("dneslovId", { status: "approved" }))
        .forEach((v) => add(v, "memory_saint_links"));
    (await db.collection("akathist_saint_links").distinct("dneslovId", { status: "approved" }))
        .forEach((v) => add(v, "akathist_saint_links"));

    // Родословная лежит отдельно, в SQLite (см. src/lib/sqlite.ts). Её может не быть
    // на машине, где гоняют синхронизацию, — это не повод не снимать остальное.
    try {
        const sqlite = new Database(process.env.SQLITE_DB!, { readonly: true, fileMustExist: true });
        const rows = sqlite
            .prepare(`select distinct dneslovId from nobles where dneslovId is not null and dneslovId != ''`)
            .all() as { dneslovId: string }[];
        rows.forEach((r) => add(r.dneslovId, "nobles"));
        sqlite.close();
    } catch (e) {
        console.warn(`nobles.db недоступна, родословную пропускаю: ${(e as Error).message}`);
    }

    if (dirty.size) {
        console.warn(`\nключи с лишними пробелами (${dirty.size}) — обрезаны здесь, но чинить в источнике:`);
        [...dirty].forEach((d) => console.warn(`  ${d}`));
    }

    return where;
};

/** Проход за ссылками на изображения: один запрос на память, поверх уже снятого. */
const syncImages = async (col: any) => {
    const stale = new Date(Date.now() - MAX_AGE_DAYS * 86400_000);
    const query: any = ONLY.length
        ? { _id: { $in: ONLY } }
        : FORCE
            ? { status: "ok" }
            : { status: "ok", $or: [{ imagesAt: { $exists: false } }, { imagesAt: { $lt: stale } }] };

    const ids = (await col.find(query, { projection: { _id: 1 } }).toArray()).map((d: any) => String(d._id));
    const plan = LIMIT ? ids.slice(0, LIMIT) : ids;

    console.log(`снимков годных:      ${await col.countDocuments({ status: "ok" })}`);
    console.log(`  за картинками к:   ${plan.length}${LIMIT && ids.length > LIMIT ? ` (из ${ids.length}, ограничено --limit)` : ""}`);

    if (!WRITE) { console.log("\nэто план. Чтобы снять, добавьте --write"); process.exit(0); }
    if (!plan.length) { console.log("\nснимать нечего"); process.exit(0); }

    let ok = 0; let failed = 0; let withImages = 0; let total = 0; let done = 0;

    const take = async () => {
        for (;;) {
            const id = plan.shift();
            if (!id) return;
            const result = await fetchMemoryImages(id, { retries: RETRIES });
            if (result.status === "ok") {
                ok++;
                if (result.images.length) { withImages++; total += result.images.length; }
                await col.updateOne({ _id: id as any }, { $set: { images: result.images, imagesAt: new Date() } });
            } else {
                failed++;
            }
            done++;
            if (done % 50 === 0) console.log(`  ...${done} (снято ${ok}, не далось ${failed})`);
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, take));

    console.log(`\nснято: ${ok}, не далось: ${failed}`);
    console.log(`памятей с картинками: ${withImages}, всего ссылок: ${total}`);
    process.exit(0);
};

const main = async () => {
    const client = await clientPromise;
    const col = client.db("typikon").collection("dneslov_memories");

    if (IMAGES) return syncImages(col);

    const found = await collectIds();
    const known = new Map(
        (await col.find({}, { projection: { fetchedAt: 1, status: 1 } }).toArray())
            .map((d: any) => [String(d._id), d]),
    );

    const stale = Date.now() - MAX_AGE_DAYS * 86400_000;
    let ids = [...found.keys()].sort((a, b) => Number(a) - Number(b));
    if (ONLY.length) ids = ids.filter((id) => ONLY.includes(id));

    const todo = ids.filter((id) => {
        if (FORCE || ONLY.length) return true;
        const have = known.get(id);
        // Не снятое и не удавшееся берём всегда; удавшееся — когда состарилось.
        if (!have || have.status !== "ok" || !have.fetchedAt) return true;
        return new Date(have.fetchedAt).getTime() < stale;
    });

    const plan = LIMIT ? todo.slice(0, LIMIT) : todo;

    console.log(`номеров в обиходе: ${ids.length}`);
    console.log(`  снято раньше:    ${ids.filter((id) => known.get(id)?.status === "ok").length}`);
    console.log(`  к снятию сейчас: ${plan.length}${LIMIT && todo.length > LIMIT ? ` (из ${todo.length}, ограничено --limit)` : ""}`);

    if (!WRITE) {
        console.log("\nэто план. Чтобы снять, добавьте --write");
        process.exit(0);
    }
    if (!plan.length) {
        console.log("\nснимать нечего");
        process.exit(0);
    }

    const counts = { ok: 0, gone: 0, error: 0 };
    const gone: string[] = [];
    const failed: string[] = [];
    let done = 0;

    const take = async () => {
        for (;;) {
            const id = plan.shift();
            if (!id) return;

            const result = await fetchMemorySnapshot(id, { retries: RETRIES, timeoutMs: TIMEOUT_MS });
            const now = new Date();
            const sources = found.get(id) ?? [];

            if (result.status === "ok") {
                counts.ok++;
                await col.updateOne(
                    { _id: id as any },
                    {
                        $set: {
                            slug: result.slug,
                            // Заголовок и короткое имя достаём наверх: по ним строится
                            // каталог и ими же удобно смотреть снимок глазами.
                            title: result.details?.title ?? result.memory?.title ?? null,
                            shortName: result.details?.short_name ?? result.memory?.short_name ?? null,
                            memory: result.memory,
                            details: result.details,
                            sources,
                            status: "ok",
                            error: null,
                            goneAt: null,
                            fetchedAt: now,
                            checkedAt: now,
                        },
                        $setOnInsert: { firstSeenAt: now },
                    },
                    { upsert: true },
                );
            } else if (result.status === "gone") {
                // Прежний снимок НЕ стираем: он единственное, что у нас останется от
                // этой памяти, и по нему человек будет разбираться, что случилось —
                // слили её с другой, переименовали или удалили.
                counts.gone++;
                gone.push(id);
                await col.updateOne(
                    { _id: id as any },
                    { $set: { status: "gone", goneAt: now, checkedAt: now, sources }, $setOnInsert: { firstSeenAt: now } },
                    { upsert: true },
                );
            } else {
                // Недоступность — не новость и не повод портить снимок: помечаем
                // попытку и оставляем прошлые данные как есть.
                counts.error++;
                failed.push(id);
                await col.updateOne(
                    { _id: id as any },
                    { $set: { error: result.error, checkedAt: now, sources }, $setOnInsert: { status: "error", firstSeenAt: now } },
                    { upsert: true },
                );
            }

            done++;
            if (done % 25 === 0) console.log(`  ...${done} (успешно ${counts.ok}, нет ${counts.gone}, не далось ${counts.error})`);
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, take));

    console.log(`\nснято: ${counts.ok}, исчезло у них: ${counts.gone}, не далось: ${counts.error}`);
    if (gone.length) {
        console.log(`\nИСЧЕЗЛИ у dneslov (внешний ключ протух, нужно решение человека):\n  ${gone.join(", ")}`);
    }
    if (failed.length) {
        console.log(`\nне ответили, повторить следующим проходом:\n  ${failed.slice(0, 40).join(", ")}${failed.length > 40 ? ` ... и ещё ${failed.length - 40}` : ""}`);
    }
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
