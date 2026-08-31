// Престолы храмов: разбор названия по словарю посвящений.
//
// ЧТО ЭТО ЗА ШАГ. Импорт привозит храм с именем и точкой на карте; кому он
// посвящён, в выгрузке не сказано. Здесь имя читается словарём
// (@/utils/dedications) и превращается в престол, а престол — в память
// устава. Только после этого храм годится для подвязки: движку нужен
// memory_id, а не строка «Никольская церковь».
//
// РАЗБОР — ДОГАДКА, И ОН ЕЮ И ОСТАЁТСЯ. Название лжёт чаще, чем кажется:
// «Церковь Софии, Премудрости Божией (Николая Чудотворца)» — престолов два,
// «Владимирская церковь» — то ли икона, то ли равноапостольный князь, а
// «Красная церковь» не называет никакого. Поэтому результат кладётся со
// статусом `pending` и со степенью уверенности, а не выдаётся за факт:
// показывать читателю и отдавать уставу можно только разобранное (`approved`).
// Тот же приём, что у связей памятей со святыми (memory_saint_links).
//
// ПРЕСТОЛОВ У ХРАМА НЕСКОЛЬКО, и часть их видна прямо в имени:
// «Сретенско-Преображенская церковь» называет два. Главным считаем названный
// первым — имя начинают с главного.
//
// ПРИДЕЛ И ЕСТЬ ПРЕСТОЛ, один к одному: в приделе престол свой, и «придел
// Никольский» значит «престол святителя Николая». Разница между записями
// здесь только в том, главный престол или нет.
//
// ВСЕХ ПРЕСТОЛОВ ИМЯ НЕ НАЗЫВАЕТ НИКОГДА. У храма с тремя приделами в имени
// стоит один престол, остальные знает приход: ни в Wikidata, ни в OSM их нет
// полем. Сверх того бывает престол УТРАЧЕННЫЙ — освящённый здесь когда-то и
// упразднённый, память которого приход всё равно празднует; такой не выводится
// ниоткуда и ставится только руками. Поэтому разбор имени — нижняя граница, а
// не полный список, и карточка об этом говорит прямо.
//
// Запуск:  npm run temples:match [-- --write] [-- --show 40]
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import {
    matchDedications, NOT_ORTHODOX, NOT_ORTHODOX_DEDICATION, normalizeTempleName,
    type DedicationMatch,
} from "@/utils/dedications";

/**
 * Насколько разбору можно верить. По этому числу разбор в админке решает, что
 * смотреть первым, а страница — что можно показывать.
 *
 * Решают два обстоятельства, и оба настоящие, а не выведенные из длины
 * строки: каким ярусом словаря нашлось (точный образец называет посвящение,
 * короткая основа лишь совпадает буквами) и одно ли посвящение видно в имени.
 *
 *  0.9 — точный образец, других посвящений в имени нет;
 *  0.6 — точный образец, но имя называет и другие («…(Никольская церковь)»);
 *  0.5 — короткая основа, других нет: имя могло прийти и от места;
 *  0.3 — короткая основа при многозначном имени — почти наверняка на разбор.
 */
const confidenceOf = (hit: DedicationMatch, others: number): number => {
    if (hit.tier === "pattern") return others ? 0.6 : 0.9;
    return others ? 0.3 : 0.5;
};

/**
 * Непервый престол вернее главного не бывает. Второе имя в названии — это и
 * престол придела, и ансамбль из двух храмов, и прежнее посвящение; какое из
 * трёх, по имени не разобрать, и уверенность у него заведомо ниже.
 */
const SIDE_ALTAR_PENALTY = 0.2;

const main = async () => {
    const argv = process.argv;
    const write = argv.includes("--write");
    const show = Number(argv[argv.indexOf("--show") + 1]) || 25;

    const db = (await clientPromise).db("typikon");
    const temples = db.collection("temples");
    const dedications = db.collection("dedications");

    const dedBySlug = new Map((await dedications.find({}).toArray()).map((d: any) => [d.slug, d]));
    if (!dedBySlug.size) {
        console.error("словарь посвящений пуст — сперва npm run temples:dedications -- --write");
        process.exit(1);
    }

    const all = await temples.find({}, { projection: { slug: 1, name: 1, kind: 1, prestoly: 1 } }).toArray();
    console.log(`храмов в каталоге: ${all.length}`);

    let matched = 0, foreign = 0, silent = 0, kept = 0, notTemple = 0, ambiguous = 0;
    const counts = new Map<string, number>();
    const unmatched: string[] = [];

    for (const t of all as any[]) {
        // Уже разобранное человеком не трогаем: правка руками старше догадки.
        if ((t.prestoly ?? []).some((p: any) => p.status === "approved")) { kept++; continue; }
        if (t.kind === "not-temple") { notTemple++; continue; }

        const text = normalizeTempleName(t.name ?? "");
        if (NOT_ORTHODOX.test(text) || NOT_ORTHODOX_DEDICATION.test(text)) {
            foreign++;
            if (write) await temples.updateOne({ _id: t._id }, { $set: { orthodox: false, prestoly: [] } });
            continue;
        }

        const found = matchDedications(t.name ?? "");
        if (!found.length) { silent++; unmatched.push(t.name); continue; }

        matched++;
        counts.set(found[0].dedication.short, (counts.get(found[0].dedication.short) ?? 0) + 1);
        if (found.length > 1) ambiguous++;
        if (!write) continue;

        const now = new Date();
        const prestoly = found.map((hit, i) => {
            const d = dedBySlug.get(hit.dedication.slug)!;
            const confidence = confidenceOf(hit, found.length - 1) - (i ? SIDE_ALTAR_PENALTY : 0);
            return {
                dedication: d.slug,
                label: d.label,
                // Главный — названный первым: имя храма начинают с главного.
                isMain: i === 0,
                kind: d.kind,
                // Память кладём копией, а не ссылкой: страница храма и
                // подвязка спрашивают её на каждый показ, а меняется она
                // только при пересборке словаря.
                memoryIds: (d.feasts ?? []).map((f: any) => f.memoryId).filter(Boolean),
                source: i === 0 ? "name" : "name-secondary",
                pattern: hit.pattern,
                tier: hit.tier,
                confidence: Math.round(confidence * 100) / 100,
                status: "pending",
                matchedAt: now,
            };
        });

        await temples.updateOne({ _id: t._id }, {
            $set: { orthodox: true, prestoly },
            // Поле прежнего разбора: там лежал шум из скобок, и держать его
            // рядом с настоящими приделами нельзя — спутается.
            $unset: { alternatives: "" },
        });
    }

    console.log(`  разобрано: ${matched}; молчит словарь: ${silent}; инославных: ${foreign}` +
        `; не храмы: ${notTemple}; оставлено как выверено руками: ${kept}`);
    const base = matched + silent;
    if (base) console.log(`  доля разобранных среди православных: ${Math.round(matched * 100 / base)}%`);
    console.log(`  имя называет больше одного престола: ${ambiguous}`);

    console.log("\nтоп посвящений:");
    [...counts].sort((a, b) => b[1] - a[1]).slice(0, 15)
        .forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));

    if (unmatched.length) {
        console.log(`\nсловарь молчит (первые ${show}) — это очередь на пополнение словаря, а не брак:`);
        unmatched.slice(0, show).forEach((n) => console.log(`   ${n}`));
    }

    if (!write) console.log("\nпробный прогон; чтобы записать — --write");
};

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
