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
// Страниц берём несколько: выдача идёт по 25, а «Солу́нских» у dneslov
// полсотни, и нужный Дими́трий на первой не помещался.
const PAGES = 3;

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
        if (list === null) return page === 1 ? null : out;
        out.push(...list);
        if (list.length < 25) break;
        await sleep(DELAY_MS);
    }
    return out;
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
    if (hit) return hit.list;
    const list = await searchDneslov(term);
    if (list === null) return null;
    await col.updateOne({ term }, { $set: { term, list, fetchedAt: new Date() } }, { upsert: true });
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
