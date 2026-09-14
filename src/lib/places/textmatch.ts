// Упоминания мест в текстах корпуса: Пролог, Четьи-Минеи, отцы.
//
// ПРАВИЛО СТРОЖЕ, ЧЕМ ДЛЯ ПИСАНИЯ. В стихах Писания имя ищется там, где его уже
// указал OpenBible, и сравнение там нарочно терпимое (@/lib/places/biblematch):
// е и и, о и а — одна буква, основа короткого имени. В прозе подсказки нет, и то же
// правило на пробе дало 42 тысячи «упоминаний»: Верия находилась в «веры», Сене в
// «сего», Син в «Сына», Села в «сила». Поэтому здесь:
//   — буквы сравниваются без свёртки, после нормализации церковнославянского;
//   — слово начинается с основы имени, дальше только окончание (до четырёх букв)
//     или суффикс прилагательного («Египетстей», «Антиохийский»);
//   — имена короче пяти букв не ищутся вовсе (Оно, Ана, Кир, Дан).
//
// ЗАГЛАВНАЯ БУКВА. Гражданская печать корпуса пишет собственные имена с большой буквы,
// уставная церковнославянская — со строчной. Где заглавные есть, слово со строчной
// без признака места отбрасывается; где их нет, берутся только совпадения с признаком.
//
// РЕШЕНИЕ. Принимается само упоминание с признаком места и не из тёзок:
//   place-word — за два слова до имени «град», «страна», «пустыня», «гора», «река»…;
//   adjective  — имя стоит прилагательным: так пишут о кафедре и о родине.
// Имя с заглавной без признака — на ревью в /admin/places/mentions. Прочее не пишется.
import { normalizeQuery } from "@/lib/search";
import { stripDescriptors } from "@/lib/places/naming";

export interface Word { norm: string; start: number; end: number; cap: boolean }

// Разделители — пробелы, знаки препинания и разметка корпуса ({pl|…}, **…**).
const WORD = /[^\s.,;:!?()«»"“”„\[\]{}|*_\\/—–-]+/g;

const letters = (s: string) => normalizeQuery(s).replace(/[^а-яa-z]/g, "");

/** Слова текста с их положением в исходной строке — фрагмент берётся из текста, а не из нормализованной копии. */
export const splitWords = (content: string): Word[] => {
    const words: Word[] = [];
    for (const m of content.matchAll(WORD)) {
        const norm = letters(m[0]);
        if (!norm) continue;
        const first = m[0].match(/\p{L}/u)?.[0] ?? "";
        words.push({ norm, start: m.index!, end: m.index! + m[0].length, cap: first !== "" && first !== first.toLowerCase() });
    }
    return words;
};

export interface TextForm {
    name: string;
    key: string;
    stem: string;
    /** Имя пишется в два слова или через дефис («Беф-Шемеш»): только такое ищется парой соседних слов. */
    compound: boolean;
}

const MIN_KEY = 5;

/** Имена под титлом: полными буквами их в тексте нет. */
const ABBREVIATED: Record<string, string[]> = { "иерусалим": ["иерлим"] };

/**
 * Формы имени для прозы, от пяти букв. Варианты — по правилу заголовка
 * (@/lib/places/naming#stripDescriptors): скобки, прилагательное, «Тель». Правило
 * поиска по стихам режет и существительное («Город Давида» → «Давида»), и в прозе
 * такое имя находит царя Давида.
 */
export const textForms = (names: string[]): TextForm[] => {
    const out = new Map<string, TextForm>();
    const add = (name: string, key: string, compound: boolean) => {
        if (key.length < MIN_KEY || out.has(key)) return;
        // Основа — без одной конечной гласной: «Александрия» → «александри» (род. «Александрии»).
        out.set(key, { name, key, stem: key.replace(/[аяеиоуыюьй]$/, ""), compound });
    };
    for (const name of names) {
        if (!/[а-яё]/i.test(name)) continue;
        for (const variant of new Set([name, stripDescriptors(name)])) {
            const key = letters(variant);
            add(name, key, /[\s-]/.test(variant.trim()));
            for (const extra of ABBREVIATED[key] ?? []) add(name, extra, false);
        }
    }
    return [...out.values()];
};

// «-ск-» и «-ст-» прилагательного, но не «-ств-»: «иудействующе» — не Иудея.
const ADJECTIVE = /^[ьи]{0,2}(ск|ст(?!в))/;

/** Слово — форма имени: основа и окончание до трёх букв, либо основа и суффикс прилагательного. */
export const wordMatches = (token: string, form: TextForm): "case" | "adjective" | null => {
    if (!token.startsWith(form.stem)) return null;
    const rest = token.slice(form.stem.length);
    if (ADJECTIVE.test(rest) && rest.length <= 8) return "adjective";
    // Окончание длиннее трёх букв — уже другое слово: «Родосто́ла» не Родос.
    return rest.length <= 3 ? "case" : null;
};

const PLACE_WORDS = ["град", "стран", "земл", "пустын", "гор", "рек", "остров", "предел", "област", "княжени"];

/** Тёзки мест среди людей и колен: у них и признак рядом не спасает («от колена Иудина»). */
const HOMONYMS = new Set([
    "иуда", "иудея", "вениамин", "ефраим", "ефрем", "манассия", "завулон", "неффалим", "симеон", "рувим",
    "иссахар", "левий", "ханаан", "мадиам", "израиль", "иаков", "аммон", "моавъ",
]);

export type Signal = "place-word" | "adjective" | "none";

export interface IndexedForm { placeId: string; form: TextForm }

/**
 * Формы по первым трём буквам: к слову примеряются только формы с его началом.
 *
 * Одна форма — одно место. У «Египта» три записи (Египет, Древний Египет,
 * Эллинистический Египет), и слово «Египетстей» иначе стало бы упоминанием всех
 * трёх. Места передаются в порядке предпочтения, и форма достаётся первому.
 */
export const buildFormIndex = (places: { id: string; forms: TextForm[] }[]): Map<string, IndexedForm[]> => {
    const index = new Map<string, IndexedForm[]>();
    const taken = new Set<string>();
    for (const p of places) for (const form of p.forms) {
        if (taken.has(form.key)) continue;
        taken.add(form.key);
        const key = form.key.slice(0, 3);
        if (!index.has(key)) index.set(key, []);
        index.get(key)!.push({ placeId: p.id, form });
    }
    return index;
};

export interface TextHit {
    placeId: string;
    form: string;
    formKey: string;
    word: string;
    context: string;
    signal: Signal;
    capitalized: boolean;
    count: number;
}

const RADIUS = 90;

const contextAt = (content: string, start: number, end: number) => {
    const from = Math.max(0, start - RADIUS);
    const to = Math.min(content.length, end + RADIUS);
    let slice = content.slice(from, to);
    if (from > 0) slice = slice.replace(/^\S*\s/, "");
    if (to < content.length) slice = slice.replace(/\s\S*$/, "");
    return slice.replace(/\s+/g, " ").trim();
};

/**
 * Места, названные в тексте: по одному попаданию на место, с сильнейшим признаком и
 * числом повторов. `capitals` — пишет ли печать текста собственные имена с большой буквы.
 */
export const findPlaceMentions = (content: string, index: Map<string, IndexedForm[]>, capitals: boolean): TextHit[] => {
    const words = splitWords(content);
    const hits = new Map<string, TextHit>();
    const strength = (h: Pick<TextHit, "signal" | "capitalized">) => (h.signal !== "none" ? 2 : 0) + (h.capitalized ? 1 : 0);

    for (let i = 0; i < words.length; i++) {
        const candidates: [string, number, boolean][] = [[words[i].norm, words[i].end, false]];
        if (i + 1 < words.length) candidates.push([words[i].norm + words[i + 1].norm, words[i + 1].end, true]);
        for (const [token, end, pair] of candidates) {
            for (const { placeId, form } of index.get(token.slice(0, 3)) ?? []) {
                // Пара слов — только для составного имени («Беф-Шемеш»), и первое слово пары
                // должно быть началом имени целиком. Иначе склейка находит чужое: «Де́во, лоза́»
                // давало «деволоза» — Девол.
                if (pair && (!form.compound || !form.key.startsWith(words[i].norm) || words[i].norm.length >= form.stem.length)) continue;
                const kind = wordMatches(token, form);
                if (!kind) continue;
                const nearPlaceWord = [i - 1, i - 2].some((j) => j >= 0 && PLACE_WORDS.some((w) => words[j].norm.startsWith(w)));
                const signal: Signal = kind === "adjective" ? "adjective" : nearPlaceWord ? "place-word" : "none";
                const capitalized = words[i].cap;
                // Где имена пишутся с заглавной, строчное слово без признака — не имя.
                if (signal === "none" && (!capitals || !capitalized)) continue;
                // Короткая основа без признака — чаще человек: «Иуде», «Адам», «Елисей», «Ионин».
                if (signal === "none" && form.stem.length < 5) continue;

                const hit: TextHit = {
                    placeId, form: form.name, formKey: form.key, signal, capitalized, count: 1,
                    word: content.slice(words[i].start, end),
                    context: contextAt(content, words[i].start, end),
                };
                const prev = hits.get(placeId);
                if (!prev) { hits.set(placeId, hit); continue; }
                prev.count++;
                if (strength(hit) > strength(prev)) Object.assign(prev, { ...hit, count: prev.count });
            }
        }
    }
    return [...hits.values()];
};

/** Решение по попаданию: принять само или отдать на ревью. */
export const decide = (hit: Pick<TextHit, "signal" | "formKey">): "approved" | "pending" =>
    hit.signal !== "none" && !HOMONYMS.has(hit.formKey) ? "approved" : "pending";
