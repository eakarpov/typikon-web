// Перевод стиха OpenBible (английская, масоретская нумерация) в стих канона сайта
// (Елизаветинская Библия) со сверкой по славянскому тексту.
//
// ПОЧЕМУ НЕ ТАБЛИЦА ПРАВИЛ. Расхождения нумераций известны лишь в общих чертах:
// Псалтирь смещена на номер и считает надписание стихом, на стыках глав стихи
// переходят в соседнюю (3 Цар. 5:1 — это 1 Kgs 4:21), местами разбивка своя.
// Правило, выписанное по памяти, промахнётся молча. Поэтому стих ищется по самому
// тексту: в каком стихе славянской главы стоит имя этого места.
//
// ПОРЯДОК ПОИСКА. Сначала тот же номер, затем соседние стихи; в Псалтири — главы на
// одну и две раньше; если номера в главе нет вовсе — начало следующей. Что нашлось
// так, даёт опоры: из них по каждой главе источника выводится её сдвиг, и второй
// проход пробует его для оставшихся стихов. Стих без имени в тексте (местоимение,
// «град сей», или у места нет русского имени) не подтверждается и уходит на ревью
// со стихом по выведенному сдвигу. Поиска по всей главе нет: и ближайший, и
// единственный в главе стих с именем на пробе промахивались в половине случаев
// (Исх. 39:41 → 40:5 по «Скинии», «Иудея» в «Иуду»).
//
// ИМЯ СРАВНИВАЕТСЯ ПО БУКВАМ, А НЕ ПО ОСТОВУ. Согласный остов (@/lib/places/nikifor)
// годился для заглавных слов статей, но в сплошном тексте он находит «приноситъ» у
// Египта и «царьна» у Шарона. Здесь первая буква должна совпасть, а начало слова
// отстоять от формы имени не больше чем на одну правку на пять букв. Буквы, которые
// синодальная и славянская передачи пишут по-разному, сравниваются как одна: б и в
// («Беф-Арава» — «веѳара́вы»), е, и и ы («Иазер» — «і҆ази́ровꙋ»), о и а.
//
// ОСНОВНЫЕ ФОРМЫ. У места бывают имена, которые в стихе стоят и без него: у Египта
// через Wikidata пришла статья «Фараон», у Вефиля — прежнее имя «Луз». Для того же
// номера стиха это не страшно — стих указан источником, — но в соседнем стихе
// такая форма уводит к чужому. Поэтому вне своего номера ищутся только основные
// формы: входящие в основное имя места или содержащие его, и их сокращения.
import { normalizeQuery } from "@/lib/search";

export interface NameForm { name: string; key: string; stem: string; primary: boolean }

/** Имена под титлом: в тексте их нет полными буквами (ключ — после сравнительного свёртывания). */
const ABBREVIATED: Record<string, string[]> = {
    "иирусалим": ["иирлим"],
};

/**
 * Описательные первые слова меток Wikidata: «Древний Египет», «Гора Хорив». Само
 * имя в стихе стоит без них, поэтому форма берётся и из последнего слова.
 */
const DESCRIPTIVE = new Set([
    "древнии", "древняя", "древнее", "эллинистическии", "римская", "римскии", "гора", "река",
    "озеро", "долина", "пустыня", "море", "город", "царство", "держава", "тель",
]);

const letters = (s: string) => normalizeQuery(s).replace(/[^а-яa-z]/g, "");

/** Свёртывание букв, которые две передачи пишут по-разному. */
export const comparable = (s: string) =>
    s.replace(/б/g, "в").replace(/[еёэы]/g, "и").replace(/о/g, "а");

const stemOf = (key: string) =>
    key.length <= 3 ? key
        : key.length === 4 ? key.replace(/[аиуяюьъ]$/, "")
        : key.replace(/[аиуяюьъ]+$/, "");

/** Варианты написания одного имени: без скобок, без «Тель-», без описательного слова. */
export const nameVariants = (name: string): string[] => {
    const bare = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    const out = new Set([bare]);
    const words = bare.split(/[\s-]+/).filter(Boolean);
    if (words.length > 1 && DESCRIPTIVE.has(normalizeQuery(words[0]).replace(/[^а-я]/g, ""))) {
        out.add(words.slice(1).join(" "));
    }
    return [...out];
};

/**
 * Формы имени для поиска. `main` — основное имя места: формы, входящие в него или
 * содержащие его, считаются основными.
 */
export const nameForms = (names: string[], main?: string): NameForm[] => {
    const mainKeys = main && /[а-яё]/i.test(main) ? nameVariants(main).map((v) => comparable(letters(v))) : [];
    const isPrimary = (key: string) => !mainKeys.length || mainKeys.some((m) => m.includes(key) || key.includes(m));
    const out = new Map<string, NameForm>();
    const add = (name: string, key: string, primary: boolean) => {
        if (key.length < 3) return;
        const prev = out.get(key);
        if (prev) { prev.primary ||= primary; return; }
        out.set(key, { name, key, stem: stemOf(key), primary });
    };
    for (const name of names) {
        if (!/[а-яё]/i.test(name)) continue;
        for (const variant of nameVariants(name)) {
            const key = comparable(letters(variant));
            const primary = isPrimary(key);
            add(name, key, primary);
            for (const extra of ABBREVIATED[key] ?? []) add(name, extra, primary);
        }
    }
    return [...out.values()];
};

/** Слова стиха и пары соседних слов — для имён, которые пишутся раздельно или через дефис. */
export const verseTokens = (content: string): string[] => {
    const words = normalizeQuery(content).split(/[^а-яa-z]+/).filter(Boolean).map(comparable);
    return [...words, ...words.slice(1).map((w, i) => words[i] + w)];
};

const levenshtein = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return row[b.length];
};

/**
 * Слово стиха, в котором стоит имя. Имя длиннее пяти букв сравнивается с началом
 * слова (запас на окончание — «Вефилѣ», «і҆ерⷭ҇ли́мскїѧ») с допуском в одну правку на
 * пять букв. Имя до пяти букв — только основой: с одной правкой «Аврон» совпадал
 * бы с «Аароном», а короткая основа — с чем угодно («Рама» в «рамена»).
 */
export const findForm = (
    content: string,
    forms: NameForm[],
    { primaryOnly = false }: { primaryOnly?: boolean } = {},
): { form: string; word: string } | null => {
    const tokens = verseTokens(content);
    for (const f of forms) {
        if (primaryOnly && !f.primary) continue;
        const allowed = Math.floor((f.key.length - 1) / 5);
        for (const t of tokens) {
            if (t[0] !== f.key[0]) continue;
            if (allowed === 0) {
                const tail = f.stem.length >= 4 ? 5 : 3;
                if (f.stem.length >= 2 && t.startsWith(f.stem) && t.length <= f.stem.length + tail) return { form: f.name, word: t };
                continue;
            }
            // Прилагательное от имени («Египет» — «є҆гѵ́петстѣй»): начало слова — основа.
            if (f.stem.length >= 5 && t.startsWith(f.stem) && t.length <= f.stem.length + 6) return { form: f.name, word: t };
            if (t.length > f.key.length + 6) continue;
            for (const cut of [f.key.length - 1, f.key.length, f.key.length + 1]) {
                if (cut < 3 || cut > t.length) continue;
                if (levenshtein(t.slice(0, cut), f.key) <= allowed) return { form: f.name, word: t };
            }
        }
    }
    return null;
};

export type VerseCount = (chapter: number) => number | undefined;

/**
 * Стихи канона для первого прохода, по убыванию правдоподобия. Первый — тот же
 * номер. В соседнюю главу поиск уходит только в Псалтири и когда номера в главе нет
 * вовсе: если стих просто не называет места, хвост предыдущей главы нашёл бы имя в
 * чужом стихе (Нав. 2:1 → 1:15 по «Иордану»).
 */
export const candidateRefs = (canonId: string, chapter: number, verse: number, count: VerseCount): [number, number][] => {
    const out: [number, number][] = [];
    const seen = new Set<string>();
    const push = (c: number, v: number) => {
        const key = `${c}:${v}`;
        if (c < 1 || v < 1 || v > (count(c) ?? 0) || seen.has(key)) return;
        seen.add(key);
        out.push([c, v]);
    };
    const here = count(chapter);
    if (here !== undefined && verse > here) {
        for (const d of [0, 1, -1, 2, -2]) push(chapter + 1, verse - here + d);
    }
    push(chapter, verse);
    for (const d of [1, -1, 2, -2, 3, -3]) push(chapter, verse + d);
    if (canonId === "psaltir") {
        for (const dc of [-1, -2]) for (const d of [0, 1, 2, -1, 3]) push(chapter + dc, verse + d);
    }
    return out;
};

export interface Anchor { chapter: number; verse: number; canonChapter: number; canonVerse: number }

/**
 * Сдвиг главы источника по опорам: самый частый (Δглавы, Δстиха), если за него
 * хотя бы две опоры и не меньше трёх пятых всех опор главы.
 */
export const learnShifts = (anchors: Anchor[]): Map<number, { dc: number; dv: number }> => {
    const byChapter = new Map<number, Map<string, number>>();
    for (const a of anchors) {
        const key = `${a.canonChapter - a.chapter}:${a.canonVerse - a.verse}`;
        if (!byChapter.has(a.chapter)) byChapter.set(a.chapter, new Map());
        const m = byChapter.get(a.chapter)!;
        m.set(key, (m.get(key) ?? 0) + 1);
    }
    const shifts = new Map<number, { dc: number; dv: number }>();
    for (const [chapter, m] of byChapter) {
        const total = [...m.values()].reduce((s, n) => s + n, 0);
        const [key, n] = [...m].sort((x, y) => y[1] - x[1])[0];
        if (n >= 2 && n / total >= 0.6) {
            const [dc, dv] = key.split(":").map(Number);
            shifts.set(chapter, { dc, dv });
        }
    }
    return shifts;
};
