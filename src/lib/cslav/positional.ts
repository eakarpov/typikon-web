// Положение буквы: чем решается спор «о» против «ѡ» и «е» против «є».
//
// ЗАЧЕМ. Две самые крупные кучи расхождений обратной проверки по Минее — омега
// (1 036 из 1 903) и широкое є (493). Обе идут в обе стороны почти поровну,
// значит это не одно недостающее правило, а положение буквы в слове:
// родительное «-агѡ» против винительного «-аго», дательное множественное
// «-ємъ» против творительного единственного «-емъ», наречие против краткого
// прилагательного, приставки, начало слова.
//
// ЧЕМ РЕШАЕТСЯ. Не грамматикой — её пришлось бы выводить из разбора
// предложения, которого у слоя нет, — а ПОЛОЖЕНИЕМ: две буквы слева от спорной
// гласной и хвост слова справа, с отступлением к более общим ключам, когда
// узкого в таблице нет.
//
// ГДЕ ЭТО РАБОТАЕТ, А ГДЕ НЕТ. Книга выше правила: где написание
// засвидетельствовано, берётся книга, и попытка приложить правило поверх
// свидетельства делает хуже — замер показал падение с 99,0% до 98,9%. Правило
// работает там, где книги слово не знают вовсе, то есть у пришедшего правилом.
//
// ЧЕГО ОНО НЕ ПОДНИМЕТ. Указатель уже упёрся в потолок частоты: 1 461 ключ, где
// сама Минея даёт два написания, различающихся только о/ѡ, и 820 — только е/є
// («ѻби́тели» ×121 против «ѻби́тєли» ×65). Это грамматическая противоположность
// внутри книги, и выбрать между ними может лишь разбор предложения.

/** Спорные ряды: первая буква ряда — умолчание, прочие в таблице. */
export const GROUPS = ["оѡѻ", "еє"];

const DISPUTED = new RegExp(`[${GROUPS.join("")}]`);

/** Умолчание ряда, к которому принадлежит буква; null — буква не спорная. */
export const defaultOf = (letter: string): string | null => {
    const group = GROUPS.find((g) => g.includes(letter));
    return group ? group[0] : null;
};

/** Одного ли ряда две буквы. */
export const sameGroup = (a: string, b: string): boolean =>
    GROUPS.some((g) => g.includes(a) && g.includes(b));

/** Контекст → какая буква в нём стоит. Умолчания в таблицу не входят. */
export type LetterTable = Record<string, string>;

/**
 * Ключи контекста от частного к общему.
 *
 * Порядок существен: сперва спрашивается самый узкий контекст (две буквы слева
 * и весь хвост справа), и только если о нём таблица молчит — более общий. Так
 * редкое слово получает ответ по своему окончанию, а частое — по себе.
 */
export const contextKeys = (word: string, at: number): string[] => {
    const left = (n: number) => word.slice(Math.max(0, at - n), at);
    const tail = word.slice(at + 1);
    return [
        `2|∞|${left(2)}●${tail}`,
        `1|∞|${left(1)}●${tail}`,
        `0|∞|●${tail}`,
        `2|2|${left(2)}●${tail.slice(0, 2)}`,
        `1|1|${left(1)}●${tail.slice(0, 1)}`,
        `0|1|●${tail.slice(0, 1)}`,
        `1|0|${left(1)}●`,
    ];
};

/**
 * Что таблица говорит об этом месте; null — молчит.
 *
 * Ответ отдаётся только для своего ряда: контекст «●мъ» набран и по омеге, и по
 * є, и отдавать «є» на месте «о» было бы подменой ряда.
 */
export const letterAt = (table: LetterTable, word: string, at: number): string | null => {
    const group = GROUPS.find((g) => g.includes(word[at]));
    if (!group) return null;
    for (const key of contextKeys(word, at)) {
        const found = table[key];
        if (found && group.includes(found)) return found;
    }
    return null;
};

/**
 * Согласуется ли написание с положением букв.
 *
 * Считает места, где таблица говорит своё, и возвращает долю согласия. Слово
 * без спорных гласных или не узнанное таблицей даёт null: сказать о нём нечего,
 * и молчание честнее нуля.
 */
export const agreement = (table: LetterTable, word: string): number | null => {
    let asked = 0;
    let agreed = 0;
    for (let at = 0; at < word.length; at++) {
        if (!DISPUTED.test(word[at])) continue;
        const says = letterAt(table, word, at);
        if (!says) continue;
        asked++;
        if (says === word[at]) agreed++;
    }
    return asked ? agreed / asked : null;
};

/**
 * Различаются ли два написания ТОЛЬКО спорными буквами одного ряда.
 *
 * Правило прикладывается лишь к такому спору: если написания разнятся ещё
 * чем-то, положение о них не судит.
 */
export const onlyLettersApart = (a: string, b: string): boolean => {
    if (a.length !== b.length || a === b) return false;
    let differs = 0;
    for (let at = 0; at < a.length; at++) {
        if (a[at] === b[at]) continue;
        if (!sameGroup(a[at], b[at])) return false;
        differs++;
    }
    return differs > 0;
};

/** Расставить буквы по положению; changed — тронуто ли слово. */
export const placeLetters = (form: string, table?: LetterTable): { form: string; changed: boolean } => {
    if (!table) return { form, changed: false };
    const chars = [...form];
    const plain = form.normalize("NFD").replace(/[̀-ͯ҃-҉]/g, "").normalize("NFC");
    let changed = false;
    let at = 0;
    for (let i = 0; i < chars.length; i++) {
        if (/[̀-ͯ҃-҉]/.test(chars[i])) continue;
        const says = letterAt(table, plain, at);
        if (says && says !== chars[i]) { chars[i] = says; changed = true; }
        at++;
    }
    return { form: chars.join(""), changed };
};
