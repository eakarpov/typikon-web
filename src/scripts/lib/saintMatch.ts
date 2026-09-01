// Общее для сопоставителей «наше название → святой dneslov.org».
//
// Вынесено из match-akathist-saints.ts, когда за акафистами пошли памяти:
// задача одна, входы разные. У акафиста имя стоит в дательном и есть адресат
// («Акафист святителю Николаю Чудотворцу»), у памяти — в родительном и с
// кафедрой («Святи́теля Иларио́на, митрополи́та Су́ждальскаго»). Различаются
// они стоп-словами и разбором названия; всё остальное — поиск, сверка,
// счёт — общее.
import { Agent, fetch as undiciFetch } from "undici";
import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";

const UA = "typikon.su saint matcher";
export const DELAY_MS = 700;
const RETRIES = 4;
// СТРАНИЦЫ БЕРЁМ ДО КОНЦА, а не три. Выдача у dneslov идёт по 25, и трёх
// страниц не хватало: под короткую основу («васи», «павл») у него сотни
// записей, и нужный святой лежал за обрезом. Замер по 478 несопоставленным
// памятям: у 297 из них выдача упиралась ровно в 75 — то есть обрывалась не
// по концу, а по нашему пределу. Василия Великого в первых семидесяти пяти
// нет вовсе, и лучшее, что находилось, — «Васи́лий Страда́лец».
//
// ПРЕДЕЛ ВСЁ ЖЕ НУЖЕН, И НЕВЫСОКИЙ. Двадцать страниц пробовали — вышло
// плохо трижды. Одна основа берётся две минуты, на корпус это шестнадцать
// часов; нужного святого всё равно не нашлось (Василия Великого нет и в
// пятистах записях по «васил»); а сразу после прогона dneslov перестал
// отвечать вовсе — он этого не любит.
//
// Глубина запроса вообще не тот рычаг. Короткая основа даёт сотни записей в
// произвольном порядке, и рыться в них бессмысленно; зато ИЗБИРАТЕЛЬНОЕ
// слово находит сразу: «обнорск» отдаёт тринадцать записей одной страницей,
// и Обнорские в них все. Рычаг — в выборе слова для запроса, а не в числе
// страниц.
const MAX_PAGES = 6;

// Тот же приём, что в src/scripts/lib/dneslov.ts: сертификат у dneslov не
// проходит проверку, а срок на установку связи нужен больше умолчания.
const agent = new Agent({ connect: { rejectUnauthorized: false, timeout: 30000 } });

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Одно ли это слово в разных падежах.
 *
 * Отсечением фиксированной длины их не свести: «Солу́нскому» без двух букв
 * даёт «солунско», а «Солу́нский» — «солунск», и они не совпадают. Поэтому
 * сравниваем ОБЩЕЕ НАЧАЛО: слова считаются одним, если их общий префикс
 * покрывает оба, кроме окончания в три буквы, и сам не короче четырёх.
 */
export const sameWord = (a: string, b: string): boolean => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i >= 4 && a.length - i <= 3 && b.length - i <= 3;
};

/**
 * Основа для ЗАПРОСА к dneslov: он ищет по началу, и окончание только мешает.
 *
 * Резать ступенями по длине пробовали — стало хуже. Замысел был разумный:
 * «Васи́лия» при единой мерке в три буквы превращается в «васи», четыре
 * буквы, и запрос выходит слишком широким. Но замер на сорока памятях
 * показал обратное: со ступенями уверенных 18%, без них 23%. Более длинная
 * основа сужает выдачу, и нужный кандидат в неё чаще НЕ попадает — а поиск
 * dneslov отдаёт по 25 на страницу, и лишние однофамильцы дешевле, чем
 * отсутствие верного. Оставлено как было; если менять, то с замером.
 */
export const stem = (w: string) =>
    (w.length > 6 ? w.slice(0, -3) : w.length > 4 ? w.slice(0, -1) : w);

/** Значащие слова названия: без служебных и без чинов. */
export const wordsOf = (s: string, stop: Set<string>): string[] =>
    normalizeChurchSlavonic(s)
        .replace(/[^\p{L}\s]+/gu, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !stop.has(w));

export interface Candidate {
    id: number;
    names: string[];
    score: number;
    best: string;
}

// ПО КАКИМ СЛОВАМ СПРАШИВАТЬ. Запросов на память немного — три, — и выбор
// их решает дело. Прежде брались первые три по порядку, а порядок в
// заголовке службы не про важность: «Са́ввы, пе́рваго архиепи́скопа и учи́теля
// Се́рбскаго» спрашивалось по «савв, перв, учит», и «сербск» — единственное
// избирательное слово — отбрасывалось. Так потеряли топоним 101 память из
// 644 несопоставленных.
//
// ИЗБИРАТЕЛЬНОСТЬ МЕРЯЕТСЯ, А НЕ УГАДЫВАЕТСЯ. По 1306 основам, уже лежащим в
// кэше: у топонимических («ск», «цк») медиана выдачи 6 записей и в предел
// упираются 24%, у прочих — медиана 18 и упираются 42%. Топоним втрое уже,
// и спрашивать надо сперва им.
const TOPONYM_RE = /ск|цк/;

// Слова чина, звания и оборота: они стоят у сотен святых и в запросе
// бесполезны — «Христа ради юродиваго», «перваго архиепископа», «бывшаго
// деспота». В STOP их не вносим: там слова, которые надо выкинуть из СВЕРКИ,
// а эти в сверке полезны — они отличают одного Максима от другого. Бесполезны
// они именно как ЗАПРОС
const WEAK_QUERY = new Set([
    "перв", "втор", "трет", "учит", "ради", "христ", "бывш", "ина", "служб",
    "нов", "стар", "мал", "велик", "иже", "сии", "тои", "жен", "муж", "дне",
    "лет", "год", "мест", "град", "весь", "обит", "монаст", "лавр", "пуст",
]);

/**
 * Основы для запроса, от самой избирательной к самой широкой.
 *
 * Порядок: топонимы, потом прочие значащие, потом слабые — и слабые лишь
 * если без них нечего спрашивать. Длина при равенстве тоже в счёт: длинное
 * слово сужает выдачу.
 */
export const queryTerms = (ours: string[], limit = 3): string[] => {
    const stems = [...new Set(ours.map(stem))];
    const rank = (list: string[]) => list
        .map((t, i) => ({ t, i, w: WEAK_QUERY.has(t) ? 1 : 0 }))
        .sort((a, b) => a.w - b.w || b.t.length - a.t.length || a.i - b.i)
        .map(x => x.t);
    const topo = rank(stems.filter(t => TOPONYM_RE.test(t)));
    const names = rank(stems.filter(t => !TOPONYM_RE.test(t)));

    // ПО ОДНОМУ ИЗ КАЖДОГО РОДА, и лишь потом добираем. Одними топонимами
    // спрашивать нельзя: у собора святителей Гера́сима, Питири́ма и Ио́ны,
    // епископов Великопе́рмских и Устьвы́мских, три первых по избирательности
    // слова — все места, и в запрос не попало бы ни одного имени. Выдача
    // судится по объединению, и объединять надо РАЗНОЕ: по топониму приходят
    // однофамильцы без имени, по имени — тёзки без места.
    const out: string[] = [];
    if (topo.length) out.push(topo.shift()!);
    if (names.length) out.push(names.shift()!);
    while (out.length < limit && (topo.length || names.length)) {
        out.push((topo.length ? topo : names).shift()!);
    }
    return out.slice(0, limit);
};

/** Доля наших слов, нашедшихся среди имён кандидата. */
export const scoreAgainst = (ours: string[], names: string[], stop: Set<string>): number => {
    if (!ours.length) return 0;
    const theirs = names.flatMap(n => wordsOf(n, stop));
    return ours.filter(w => theirs.some(t => sameWord(w, t))).length / ours.length;
};

/** Чем можно заменить предложенное: следующие по счёту, с именами. */
export const altsOf = (scored: Candidate[]) =>
    scored.slice(0, 7).filter(c => c.score > 0)
        .map(c => ({ dneslovId: String(c.id), saintName: c.best, score: c.score }));

const searchDneslov = async (term: string): Promise<any[] | null> => {
    const out: any[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
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
        if (list === null) return page === 1 ? null : out;
        out.push(...list);
        if (list.length < 25) return out;         // страница неполна — конец выдачи
        await sleep(DELAY_MS);
    }
    return out;                                    // упёрлись в предел страниц
};

/**
 * Поиск с кэшем в Mongo `dneslov_names`.
 *
 * Кэш обязателен, а не удобен: dneslov отвечает через раз (см. src/lib/dneslov.ts),
 * и повторный прогон не должен зависеть от его настроения. Тот же кэш служит
 * обоим сопоставителям — имена у них общие.
 */
export const cachedSearch = async (col: any, term: string): Promise<any[] | null> => {
    const hit = await col.findOne({ term });
    // ОБРЕЗАННОЕ ПЕРЕСПРАШИВАЕМ. Прежние снимки сняты на трёх страницах, и
    // список ровно в 75 записей (или иное кратное 25) кончился не потому, что
    // кончилась выдача, а потому, что кончился наш предел. Признак «дошли до
    // конца» у старых записей не проставлен вовсе, и отличить полный список
    // от обрезанного можно только длиной.
    const looksTruncated = hit && hit.complete !== true
        && Array.isArray(hit.list) && hit.list.length > 0 && hit.list.length % 25 === 0;
    if (hit && !looksTruncated) return hit.list;

    const list = await searchDneslov(term);
    // DNESLOV ОТВЕЧАЕТ ЧЕРЕЗ РАЗ, и переспрашивание не должно ОТНИМАТЬ уже
    // добытое: не дозвонившись, отдаём то, что лежит в кэше с прошлого раза.
    // Пустой ответ хуже неполного
    if (list === null) return hit ? hit.list : null;
    await col.updateOne({ term }, {
        $set: {
            term, list, fetchedAt: new Date(),
            // дошли ли до конца выдачи или упёрлись в предел страниц
            complete: list.length % 25 !== 0,
        },
    }, { upsert: true });
    await sleep(DELAY_MS);
    return list;
};

/** Имена кандидата во всех начертаниях, какие даёт dneslov. */
export const namesOf = (m: any): string[] =>
    (m.short_names ?? []).map((n: any) => n.text).filter(Boolean);

export interface Verdict {
    kind: "exact" | "ambiguous" | "none";
    top?: Candidate;
    runnerUp?: Candidate;
    tied?: number;
    alternatives: ReturnType<typeof altsOf>;
}

/**
 * Разобрать кандидатов в вердикт.
 *
 * Три исхода, а не «да/нет»: уверенно, неоднозначно, не нашлось. Порог в
 * половину слов — ниже него совпадение держится на одном эпитете и ничего не
 * значит; равный счёт у двоих — именно тот случай, ради которого заведено
 * ревью, и выбирать за человека нельзя.
 */
export const judge = (ours: string[], list: any[], stop: Set<string>): Verdict => {
    const scored: Candidate[] = list.map((m: any) => {
        const names = namesOf(m);
        return { id: m.id, names, score: scoreAgainst(ours, names, stop), best: names[0] ?? "" };
    }).sort((a, b) => b.score - a.score);

    const top = scored[0];
    const runnerUp = scored[1];
    const alternatives = altsOf(scored);

    if (!top || top.score < 0.5) return { kind: "none", top, alternatives };
    if (runnerUp && runnerUp.score >= top.score) {
        return {
            kind: "ambiguous", top, runnerUp, alternatives,
            tied: scored.filter(s => s.score === top.score).length,
        };
    }
    return { kind: "exact", top, alternatives };
};
