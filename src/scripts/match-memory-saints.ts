// Кандидаты на memories.dneslov_id: какому святому dneslov.org отвечает память книги.
//
// Второй сопоставитель, следом за акафистами (match-akathist-saints.ts), и
// намеренно после них: общая механика обкаталась на входе вчетверо меньшем и
// вчетверо чище. Общее вынесено в ./lib/saintMatch.
//
// СМОТРИМ ТОЛЬКО МИНЕЮ. Из 1519 памятей корпуса лицам отвечают лишь её 1300:
// Октоих адресует гласом и днём седмицы («Октоих, глас 1, Воскресенье»),
// Триоди — расстоянием от Пасхи («Суббота 5-й седмицы»), Минея общая —
// разрядом («Служба обща преподобным»). Искать им святого не надо, потому что
// его нет.
//
// ВХОД ГРЯЗНЕЕ, ЧЕМ У АКАФИСТОВ, и это стоит знать заранее. Метка памяти —
// не обращение, а заголовок службы, и в нём бывает что угодно, кроме имени:
//
//   «Пренесе́ние моще́й святи́теля Ге́рмана, архиепи́скопа Каза́нскаго»  — событие
//   «Пра́зднование Пресвяте́й Влады́чице... Богоро́дице»                — праздник
//   «Мучеников Каза́нских Иоа́нна, Стефа́на, Петра́, Бори́са...»         — собор
//
// Событие и собор мы не отсекаем: у переноса мощей святой всё-таки один и тот
// же, а собор — законная память, просто лиц в ней несколько, и решать это
// человеку в ревью. Отсекаем только то, что заведомо не лицо (см. NOT_A_PERSON).
//
// ПАДЕЖ ЗДЕСЬ РОДИТЕЛЬНЫЙ, а у dneslov именительный: «Иларио́на» против
// «Иларио́н». Сравнение по общему началу с этим справляется. Чего оно НЕ
// умеет — церковнославянских чередований: «Су́ждальскаго» и «Су́здальский»
// расходятся на второй букве, и такие эпитеты в счёт не идут. Отсюда часть
// «не нашлось», и чинится это словарём чередований, а не порогом.
//
// Запуск:  npm run match:memories  [-- --write] [-- --limit 50] [-- --show 40]
import "@/scripts/lib/env";
import Database from "better-sqlite3";
import clientPromise from "@/lib/mongodb";
import {
    cachedSearch, judge, stem, wordsOf, type Verdict,
} from "@/scripts/lib/saintMatch";
import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";

/** Чины, титулы и обороты заголовка службы: имени они не называют. */
const STOP = new Set([
    "память", "памяти", "святаго", "святыя", "святых", "святому", "святой",
    "преподобнаго", "преподобныя", "преподобных", "преподобному",
    "святителя", "святителей", "мученика", "мученицы", "мучеников",
    "мученик", "великомученика", "великомученицы", "священномученика",
    "священномучеников", "преподобномученика", "исповедника", "исповедников",
    "праведнаго", "праведныя", "блаженнаго", "блаженныя", "благовернаго",
    "благоверныя", "апостола", "апостолов", "пророка", "архангела", "ангела",
    "иже", "во", "нашего", "нашей", "нашего", "отца", "матере", "матери",
    "архиепископа", "епископа", "митрополита", "патриарха", "игумена",
    "игумении", "архимандрита", "пресвитера", "диакона", "князя", "княгини",
    "царя", "царицы", "чудотворца", "чудотворцев", "затворника",
    "пренесение", "перенесение", "мощей", "обретение", "празднование",
    "собор", "собора", "соборе", "новых", "российских", "русских",
    "почивающаго", "пещерах", "дальних", "ближних", "лавры", "монастыря",
    "икона", "иконы", "образа", "пресвятыя", "богородицы", "владычицы",
    "приснодевы", "марии", "господа", "бога", "спаса", "христа", "иисуса",
]);

/**
 * Метки, за которыми лица нет вовсе: праздники Господни и Богородичные,
 * иконы, соборы бесплотных сил. Искать им святого — значит заведомо получить
 * ближайшего по звучанию и записать это уверенным, где ошибка тише всего.
 *
 * Проверять надо ПО СНЯТЫМ УДАРЕНИЯМ. Ударение стоит отдельным символом
 * ВНУТРИ слова, и «Предпра́знество» — это «Предпра» + U+0301 + «знество»:
 * никакой «предпраз» в нём не находится, и все предпразднства проходили
 * отсев насквозь, а потом искали себе святого.
 */
const NOT_A_PERSON = /икон|богородиц|владычиц|приснодев|господн|христов|креста|предпраз|попраз|отдание|неделя|суббот|обрезание|рождество|сретение|преображение|вознесение|пятидесятниц|троиц|бесплотных|небесных сил/i;

const main = async () => {
    const argv = process.argv;
    const limit = Number(argv[argv.indexOf("--limit") + 1]) || 0;
    const show = Number(argv[argv.indexOf("--show") + 1]) || 20;
    const write = argv.includes("--write");

    const file = process.env.RULES_DB;
    if (!file) { console.error("нет RULES_DB в окружении"); process.exit(1); }
    const db = new Database(file, { readonly: true, fileMustExist: true });

    const client = await clientPromise;
    const cache = client.db("typikon").collection("dneslov_names");
    await cache.createIndex({ term: 1 }, { unique: true });
    const links = client.db("typikon").collection("memory_saint_links");
    await links.createIndex({ memoryId: 1 }, { unique: true });

    let rows = db.prepare(`
        SELECT memory_id, label, month, day FROM memories
        WHERE book = 'menaion' AND label IS NOT NULL AND label <> ''
        ORDER BY month, day, memory_id`).all() as
        { memory_id: string; label: string; month: number; day: number }[];
    if (limit) rows = rows.slice(0, limit);

    console.log(`памятей Минеи: ${rows.length}\n`);

    const buckets: Record<string, any[]> = {
        exact: [], ambiguous: [], none: [], offline: [], notPerson: [],
    };

    for (const row of rows) {
        if (NOT_A_PERSON.test(normalizeChurchSlavonic(row.label))) {
            buckets.notPerson.push(row); continue;
        }

        const ours = wordsOf(row.label, STOP);
        if (!ours.length) { buckets.notPerson.push(row); continue; }

        // По каждому значащему слову, до трёх: порознь выдачи неполны — по
        // эпитету приходят однофамильцы без имени, по имени — тёзки без
        // эпитета, и верный ответ есть только в объединении.
        const terms = [...new Set(ours.map(stem))].slice(0, 3);
        const byId = new Map<number, any>();
        let offline = false;
        for (const t of terms) {
            const part = await cachedSearch(cache, t);
            if (part === null) { offline = true; continue; }
            for (const m of part) byId.set(m.id, m);
        }
        if (!byId.size) {
            (offline ? buckets.offline : buckets.none).push({ ...row, term: terms.join(", ") });
            continue;
        }

        const verdict: Verdict = judge(ours, [...byId.values()], STOP);
        buckets[verdict.kind].push({ ...row, term: terms.join(", "), ...verdict });
    }

    if (write) {
        let added = 0, refreshed = 0;
        for (const r of [...buckets.exact, ...buckets.ambiguous]) {
            const proposal = {
                memoryId: r.memory_id,
                title: r.label,
                month: r.month,
                day: r.day,
                kind: buckets.exact.includes(r) ? "exact" : "ambiguous",
                dneslovId: String(r.top.id),
                saintName: r.top.best,
                score: r.top.score,
                alternatives: r.alternatives ?? [],
                term: r.term,
                matchedAt: new Date(),
            };
            const existing = await links.findOne({ memoryId: r.memory_id });
            if (!existing) { await links.insertOne({ ...proposal, status: "pending" }); added++; }
            else if (existing.status === "pending") {
                await links.updateOne({ memoryId: r.memory_id }, { $set: proposal }); refreshed++;
            }
        }
        console.log(`в ревью: добавлено ${added}, освежено ждущих ${refreshed}, `
            + `решённых не тронуто ${await links.countDocuments({ status: { $ne: "pending" } })}\n`);
    }

    const n = rows.length - buckets.notPerson.length;
    const pct = (k: number) => `${k} (${n ? Math.round((k / n) * 100) : 0}%)`;
    console.log("=== итог");
    console.log(`  уверенно:      ${pct(buckets.exact.length)}`);
    console.log(`  неоднозначно:  ${pct(buckets.ambiguous.length)}`);
    console.log(`  не нашлось:    ${pct(buckets.none.length)}`);
    if (buckets.offline.length) console.log(`  dneslov молчал: ${buckets.offline.length}`);
    console.log(`  не лицо (не искали): ${buckets.notPerson.length}`);

    console.log("\n=== уверенные:");
    for (const r of buckets.exact.slice(0, show)) {
        console.log(`  ${String(Math.round(r.top.score * 100)).padStart(3)}%  `
            + `${String(r.month).padStart(2)}-${String(r.day).padStart(2)}  `
            + `${r.label.slice(0, 50).padEnd(52)} → ${r.top.best} (#${r.top.id})`);
    }
    console.log("\n=== неоднозначные:");
    for (const r of buckets.ambiguous.slice(0, show)) {
        console.log(`  ${r.tied} равных  ${r.label.slice(0, 44).padEnd(46)} → ${r.top.best} | ${r.runnerUp?.best}`);
    }
    console.log("\n=== не нашлось:");
    for (const r of buckets.none.slice(0, show)) {
        console.log(`  q=${(r.term ?? "—").slice(0, 24).padEnd(26)} ${r.label.slice(0, 52)}`);
    }
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
