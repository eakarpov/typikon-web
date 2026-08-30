// Кандидаты на akathists.dneslov_id: какому святому dneslov.org обращён наш акафист.
//
// СТАТУС: замер. Скрипт ничего не пишет в корпус — он печатает отчёт о том,
// сколько акафистов сопоставилось и насколько уверенно. Порядок тот же, каким
// шёл link-text-mentions.ts: сперва измерить точность, потом решать, нужно ли
// ревью в админке и можно ли часть проставлять автоматически.
//
// ПОЧЕМУ ЭТО МОЖЕТ ВЫЙТИ ТАМ, ГДЕ НЕ ВЫШЛО С ЧТЕНИЯМИ. У текстов имя в
// названии — часто АВТОР, а не святой дня («Слово Иоанна Златоустаго» стоит в
// память Прокла), и разделить их было нечем. У акафиста имя — адресат по
// определению, и стоит оно в дательном: «Акафист святителю Николаю
// Чудотворцу». Авторства в этой позиции не бывает.
//
// ДВЕ ТРУДНОСТИ, И ОБЕ ЛОЖАТСЯ НА ОСНОВУ СЛОВА.
//
//   1. Падеж. У нас дательный, у dneslov — именительный: «Никола́ю» против
//      «Никола́й». Точным сравнением их не свести, поэтому и запрос, и сверка
//      идут по ОСНОВЕ: слово без двух последних букв. Приём грубый, но здесь
//      достаточный — различают святых не окончания, а корни и эпитеты.
//   2. Омонимия. «Иоанн» — восемнадцать святых, «Феодор» — восемнадцать
//      (замер из link-text-mentions.ts). Поэтому кандидат принимается не по
//      совпадению имени, а по доле совпавших слов ЦЕЛИКОМ: «Николаю
//      Чудотворцу» против «Никола́й Мирлики́йский» даёт половину, а против
//      «Никола́й Чудотво́рец» — единицу.
//
// Ответы dneslov кладём в коллекцию `dneslov_names`: сервис отвечает через
// раз (см. src/lib/dneslov.ts), и второй прогон не должен зависеть от его
// настроения. Заодно тот же кэш пригодится шагу записи, когда он появится.
//
// С --write кандидаты ложатся в Mongo `akathist_saint_links` — на ревью в
// админке (/admin/akathists). Уже разобранные строки при этом НЕ трогаются:
// повторный прогон досыпает новых кандидатов, а не отменяет чужие решения.
//
// Запуск:  npm run match:akathists  [-- --write] [-- --limit 50] [-- --show 40]
import "@/scripts/lib/env";
import { Agent, fetch as undiciFetch } from "undici";
import Database from "better-sqlite3";
import clientPromise from "@/lib/mongodb";
import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";

const UA = "typikon.su akathist-saint matcher";
const DELAY_MS = 700;
const RETRIES = 4;
// Тот же приём, что в src/scripts/lib/dneslov.ts: сертификат у dneslov не
// проходит проверку, а срок на установку связи нужен больше умолчания.
const agent = new Agent({ connect: { rejectUnauthorized: false, timeout: 30000 } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Слова, которые не называют святого: чин, титул, служебное. */
const STOP = new Set([
    "акафист", "святому", "святой", "святым", "святаго", "святому",
    "преподобному", "преподобной", "преподобным", "преподобному",
    "святителю", "святителям", "мученику", "мученице", "мученикам",
    "великомученику", "великомученице", "священномученику", "исповеднику",
    "праведному", "праведной", "блаженному", "блаженной", "благоверному",
    "благоверной", "апостолу", "пророку", "архангелу", "ангелу",
    "чудотворцу", "чудотворцам", "и", "во", "в", "на", "отцу", "нашему",
    "первому", "второму", "князю", "княгине", "царю", "царице", "иже",
    // Обороты, которые стоят при имени, но святого не называют. Без них
    // запрос уходил в «христа» и «ради», а счёт делился на слова, которых у
    // dneslov в имени нет и быть не может.
    "христа", "ради", "юродивому", "юродивой", "собору", "отец", "отцов",
    "новому", "новой", "нашему", "нашей", "исповедникам", "страстотерпцу",
    "страстотерпцам", "мучеником", "всех", "святых", "земли", "русской",
]);

/**
 * Одно ли это слово в разных падежах.
 *
 * Отсечением фиксированной длины их не свести: «Солу́нскому» без двух букв
 * даёт «солунско», а «Солу́нский» — «солунск», и они не совпадают. Поэтому
 * сравниваем не обрубки, а ОБЩЕЕ НАЧАЛО: слова считаются одним, если их
 * общий префикс покрывает оба, кроме окончания в три буквы, и сам не короче
 * четырёх. «димитрию»/«димитрий» — префикс «димитри», по букве в остатке;
 * «нестор»/«димитрию» — общего начала нет вовсе.
 */
const sameWord = (a: string, b: string): boolean => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i >= 4 && a.length - i <= 3 && b.length - i <= 3;
};

/**
 * Основа для ЗАПРОСА к dneslov: он ищет по началу, и окончание только мешает.
 * Короткие имена тоже надо усекать — «И́горю» без последней буквы находит
 * «И́горь», а целиком не находит ничего.
 */
const stem = (w: string) => (w.length > 6 ? w.slice(0, -3) : w.length > 4 ? w.slice(0, -1) : w);

const words = (s: string): string[] =>
    normalizeChurchSlavonic(s)
        .replace(/[^\p{L}\s]+/gu, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP.has(w));

// Акафисты СОНМУ, а не лицу: «всем святым, в земли Русской просиявшим»,
// «собору преподобных отцов Оптинских», «общий преподобному единому». Их
// двенадцать из 439, и искать им одного святого не надо — не потому что
// трудно, а потому что его нет. Без этой отсечки они находили ближайшего по
// звучанию («Блаженный един» для «общего преподобному единому») и попадали в
// уверенные, где ошибка тише всего.
const COLLECTIVE_RE = /общий|общая|всем святым|всех святых|собор[уа]?\s|соборо|новомученикам|просиявш|во святой горе/i;

interface Candidate { id: number; names: string[]; score: number; best: string }

/** Чем можно заменить предложенное: следующие по счёту, с именами. */
const altsOf = (scored: Candidate[]) =>
    scored.slice(0, 7).filter(c => c.score > 0)
        .map(c => ({ dneslovId: String(c.id), saintName: c.best, score: c.score }));

// Страниц берём несколько: выдача идёт по 25, а «Солу́нских» у dneslov
// полсотни, и нужный Дими́трий на первой не помещался — пятнадцать кандидатов
// набирали одинаковый счёт по одному эпитету, и разобрать их было нечем.
const PAGES = 3;

const searchDneslov = async (term: string): Promise<any[] | null> => {
    const out: any[] = [];
    for (let page = 1; page <= PAGES; page++) {
        const url = `https://dneslov.org/memories.json?q=${encodeURIComponent(term)}&page=${page}`;
        let list: any[] | null = null;
        for (let i = 0; i < RETRIES; i++) {
            try {
                const res = await undiciFetch(url, { headers: { "User-Agent": UA }, dispatcher: agent });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const body = await res.json() as any;
                list = body?.list ?? [];
                break;
            } catch {
                await sleep(1200 * (i + 1));
            }
        }
        if (list === null) return page === 1 ? null : out;   // первая не дошла — ответа нет вовсе
        out.push(...list);
        if (list.length < 25) break;
        await sleep(DELAY_MS);
    }
    return out;
};

const cachedSearch = async (col: any, term: string): Promise<any[] | null> => {
    const hit = await col.findOne({ term });
    if (hit) return hit.list;
    const list = await searchDneslov(term);
    if (list === null) return null;
    await col.updateOne({ term }, { $set: { term, list, fetchedAt: new Date() } }, { upsert: true });
    await sleep(DELAY_MS);
    return list;
};

/** Доля наших слов, нашедшихся среди имён кандидата. */
const score = (ours: string[], names: string[]): number => {
    if (!ours.length) return 0;
    const theirs = names.flatMap(n => words(n));
    return ours.filter(w => theirs.some(t => sameWord(w, t))).length / ours.length;
};

/**
 * Кандидаты — в Mongo, на ревью.
 *
 * Не в корпус: `data.db` пересобирается с нуля каждым build_db.py, и всё, что
 * записано туда руками, исчезает при следующей сборке. Подтверждённые связи
 * поэтому едут не в базу, а в правила typikon-rules — см. export-akathist-saints.ts.
 *
 * Уже разобранные строки не трогаем: повторный прогон досыпает новых
 * кандидатов и освежает предложения у ЖДУЩИХ, но решения человека не
 * отменяет — иначе вечерний просмотр обнулялся бы утренним прогоном.
 */
const saveCandidates = async (client: any, buckets: any) => {
    const col = client.db("typikon").collection("akathist_saint_links");
    await col.createIndex({ akathistId: 1 }, { unique: true });

    const rows = [
        ...buckets.exact.map((r: any) => ({ ...r, kind: "exact" })),
        ...buckets.ambiguous.map((r: any) => ({ ...r, kind: "ambiguous" })),
    ];

    let added = 0, refreshed = 0;
    for (const r of rows) {
        const proposal = {
            akathistId: r.akathist_id,
            title: r.title,
            kind: r.kind,
            dneslovId: String(r.top.id),
            saintName: r.top.best,
            score: r.top.score,
            alternatives: (r.alternatives ?? []).slice(0, 6),
            term: r.term,
            matchedAt: new Date(),
        };
        const existing = await col.findOne({ akathistId: r.akathist_id });
        if (!existing) {
            await col.insertOne({ ...proposal, status: "pending" });
            added++;
        } else if (existing.status === "pending") {
            await col.updateOne({ akathistId: r.akathist_id }, { $set: proposal });
            refreshed++;
        }
    }
    console.log(`\nв ревью: добавлено ${added}, освежено ждущих ${refreshed}, `
        + `решённых не тронуто ${await col.countDocuments({ status: { $ne: "pending" } })}`);
};

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

    let rows = db.prepare(
        "SELECT akathist_id, title FROM akathists WHERE subject_kind = 'svyatoy' ORDER BY title",
    ).all() as { akathist_id: string; title: string }[];
    if (limit) rows = rows.slice(0, limit);

    console.log(`акафистов святым: ${rows.length}\n`);

    const buckets = { exact: [] as any[], ambiguous: [] as any[], none: [] as any[],
                      offline: [] as any[], collective: [] as any[] };

    for (const row of rows) {
        if (COLLECTIVE_RE.test(row.title)) { buckets.collective.push(row); continue; }
        const ours = words(row.title);
        if (!ours.length) { buckets.none.push({ ...row, why: "в названии не осталось слов" }); continue; }

        // Спрашиваем ПО КАЖДОМУ значащему слову и складываем выдачи.
        //
        // Одним словом не обойтись, и это выяснилось замером: по эпитету
        // («солунск») приходят полсотни Солунских без Димитрия, по имени
        // («димитри») — Димитрии без нужного эпитета. Порознь ни та, ни другая
        // выдача не содержит верного ответа; вместе — содержит.
        const terms = [...new Set(ours.map(stem))].slice(0, 3);
        const byId = new Map<number, any>();
        let offline = false;
        for (const t of terms) {
            const part = await cachedSearch(cache, t);
            if (part === null) { offline = true; continue; }
            for (const m of part) byId.set(m.id, m);
        }
        if (!byId.size) {
            if (offline) buckets.offline.push({ ...row, term: terms.join(", ") });
            else buckets.none.push({ ...row, term: terms.join(", ") });
            continue;
        }
        const term = terms.join(", ");
        const list = [...byId.values()];

        const scored: Candidate[] = list.map((m: any) => {
            const names = (m.short_names ?? []).map((n: any) => n.text).filter(Boolean);
            return { id: m.id, names, score: score(ours, names), best: names[0] ?? "" };
        }).sort((a: Candidate, b: Candidate) => b.score - a.score);

        const top = scored[0];
        const runnerUp = scored[1];
        if (!top || top.score < 0.5) {
            buckets.none.push({ ...row, term, top: top?.best, score: top?.score ?? 0 });
        } else if (runnerUp && runnerUp.score >= top.score) {
            // Двое и больше с одинаковым счётом — именно тот случай, ради
            // которого затевалось ревью: выбрать за человека нельзя.
            buckets.ambiguous.push({ ...row, term, top, runnerUp,
                                     tied: scored.filter(s => s.score === top.score).length,
                                     alternatives: altsOf(scored) });
        } else {
            // Альтернативы кладём и к уверенным: ревью — это «подтвердить или
            // поправить», и поправлять надо чем-то, не уходя со страницы.
            buckets.exact.push({ ...row, term, top, alternatives: altsOf(scored) });
        }
    }

    if (write) await saveCandidates(client, buckets);

    const n = rows.length - buckets.collective.length;
    const pct = (k: number) => `${k} (${Math.round((k / n) * 100)}%)`;
    console.log("=== итог");
    console.log(`  уверенно:      ${pct(buckets.exact.length)}`);
    console.log(`  неоднозначно:  ${pct(buckets.ambiguous.length)}`);
    console.log(`  не нашлось:    ${pct(buckets.none.length)}`);
    if (buckets.offline.length) console.log(`  dneslov молчал: ${buckets.offline.length}`);
    console.log(`  сонму, а не лицу (не искали): ${buckets.collective.length}`);

    console.log("\n=== уверенные (проверьте глазами):");
    for (const r of buckets.exact.slice(0, show)) {
        console.log(`  ${String(Math.round(r.top.score * 100)).padStart(3)}%  ${r.title.slice(0, 54).padEnd(56)} → ${r.top.best} (#${r.top.id})`);
    }
    console.log("\n=== неоднозначные:");
    for (const r of buckets.ambiguous.slice(0, show)) {
        console.log(`  ${r.tied} равных  ${r.title.slice(0, 46).padEnd(48)} → ${r.top.best} | ${r.runnerUp.best}`);
    }
    console.log("\n=== не нашлось:");
    for (const r of buckets.none.slice(0, show)) {
        console.log(`  q=${(r.term ?? "—").padEnd(16)} ${r.title.slice(0, 52).padEnd(54)} ${r.top ? `лучший ${r.top} (${Math.round(r.score * 100)}%)` : r.why ?? ""}`);
    }
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
