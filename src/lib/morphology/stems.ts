// Основы: как из леммы получаются те варианты основы, на которые ссылаются таблицы.
//
// В таблицах Полякова окончание может быть записано с цифрой впереди — «отроц-2ѣ»,
// «свитч-4е», «имен-2емъ». Прочтение цифры как НОМЕРА ОСНОВЫ объясняет всё, что видно
// в таблицах: у «свитокъ» основ четыре — свитк- (без номера), свиток- (2), свитц- (3),
// свитч- (4), и нумерация идёт в порядке первого появления сверху вниз; у «отрокъ» три,
// у «имя» две. Ни палатализацией, ни ударением цифры быть не могут: они стоят и у
// сонорных (имен-, матер-, свекров-), и там, где чередования нет вовсе (осел-, окон-).
//
// Прочтение пока НЕ подтверждено легендой издания — см. вопрос владельцу. Если цифра
// окажется чем-то другим, поменяется только запись таблиц, но не устройство модуля:
// основы всё равно приходится строить, как их ни нумеруй.

const COMBINING = /[̀-ͯ҃-҉]/;
const VOWEL = /[аеёиоуыэюяєѣіїѵѡѻꙋѹѧѫꙗѩᲂ]/i;

/**
 * Убирает последнюю гласную основы вместе с её надстрочными знаками.
 *
 * Беглый гласный уносит с собой и ударение: «осе́лъ» — это о,с,е,U+0301,л,ъ, и если
 * снять одну букву «е», знак останется висеть на согласной («ослъ» с ударением после
 * с). Такую форму проверка ударений считает ошибкой набора — и будет права.
 */
export const dropFleeting = (stem: string) => {
    const chars = [...stem];
    for (let i = chars.length - 1; i >= 0; i--) {
        if (!VOWEL.test(chars[i]) || COMBINING.test(chars[i])) continue;
        let to = i + 1;
        while (to < chars.length && COMBINING.test(chars[to])) to++;
        return chars.slice(0, i).concat(chars.slice(to)).join("");
    }
    return stem;
};

/**
 * Вставляет беглый гласный перед последней согласной: «окн» → «окон», «гривн» → «гривен».
 *
 * Какой именно гласный, синхронно не выводится: «окно» даёт «око́нъ», а «гри́вна» —
 * «гриве́нъ», и обе основы кончаются на «н». Разница историческая (окъно против гривьна),
 * и в самой лемме её следов не осталось. Берём «о» после задненёбной, «е» в остальных
 * случаях — и полагаемся на то, что у большинства таких лексем эта форма выписана в
 * словаре и подставится готовой (см. mergeStored в decline.ts).
 */
export const insertFleeting = (stem: string) => {
    // «-льн» даёт «-ленъ», а не «-льенъ»: беглый гласный встаёт НА МЕСТО мягкого знака,
    // а не после него. В словаре так набрана тысяча с лишним прилагательных на -льный.
    const soft = /ь([бвгджзклмнпрстфхцчшщ])$/;
    const bare = [...stem].filter((ch) => !COMBINING.test(ch)).join("");
    if (soft.test(bare)) {
        const at = stem.lastIndexOf("ь");
        if (at >= 0) return stem.slice(0, at) + "е" + stem.slice(at + 1);
    }

    const chars = [...stem];
    let last = chars.length - 1;
    while (last >= 0 && COMBINING.test(chars[last])) last--;
    if (last < 1) return stem;

    const vowel = /[кгх]/.test(chars[last]) ? "о" : "е";
    // Перед последней согласной, но после всей диакритики предыдущей буквы.
    let at = last;
    while (at > 0 && COMBINING.test(chars[at - 1])) at--;
    chars.splice(at, 0, vowel);
    return chars.join("");
};

const lastConsonant = (stem: string) => {
    const chars = [...stem];
    for (let i = chars.length - 1; i >= 0; i--) {
        if (COMBINING.test(chars[i])) continue;
        return { ch: chars[i], at: i };
    }
    return null;
};

const swapLast = (stem: string, map: Record<string, string>) => {
    const last = lastConsonant(stem);
    if (!last || !map[last.ch]) return stem;
    const chars = [...stem];
    chars[last.at] = map[last.ch];
    return chars.join("");
};

/** Вторая палатализация: перед ѣ и и — отроцѣ, вразѣ, дусѣ, руцѣ. */
// Основа на «-ск-» ведёт себя особо: не «сц», а «ст» — «а҆враа́мскій» даёт
// «а҆враа́мстѣй» и «а҆враа́мстїи», а не «а҆враа́мсцѣй». Таких прилагательных в словаре
// больше половины заднеязычных, так что оговорка не редкая.
const SK = /ск$/;

export const secondPalatalization = (stem: string) => {
    const bare = stem.replace(/[̀-ͯ҃-҉]/g, "");
    if (SK.test(bare)) return swapLast(stem, { к: "т" });
    return swapLast(stem, { к: "ц", г: "з", х: "с" });
};

/** Первая палатализация: звательный — отроче, враже, душе, отче. */
export const firstPalatalization = (stem: string) =>
    swapLast(stem, { к: "ч", г: "ж", х: "ш", ц: "ч" });

/**
 * Отрезает от леммы конечную букву, названную схемой, вместе с её надстрочными знаками.
 *
 * Простым `replace(/е$/)` тут не обойтись: в «лице́» последний символ — не «е», а
 * ударение над ним (U+0301), и регулярка не срабатывает вовсе. На таких леммах
 * порождение выдавало «лице́е» вместо «лица́», и целые схемы уходили в ноль.
 */
export const cut = (lemma: string, letters: string) => {
    const chars = [...lemma];
    let last = chars.length - 1;
    while (last >= 0 && COMBINING.test(chars[last])) last--;
    if (last < 0 || !letters.includes(chars[last])) return lemma;
    return chars.slice(0, last).join("");
};

/** Отрезает от леммы конечное сочетание («ти», «нути», «сти»), не спотыкаясь о надстрочные знаки. */
export const cutSuffix = (lemma: string, suffix: string) => {
    if (!suffix) return lemma;
    const bare = [...lemma].filter((ch) => !COMBINING.test(ch)).join("");
    if (!bare.endsWith(suffix)) return lemma;

    // Считаем буквы с конца, пропуская диакритику: она уходит вместе со своей буквой.
    const chars = [...lemma];
    let left = suffix.length;
    let at = chars.length;
    while (at > 0 && left > 0) {
        at--;
        if (!COMBINING.test(chars[at])) left--;
    }
    return chars.slice(0, at).join("");
};

// Иотация: чередование основы перед -ю и перед -ен-. Люб-ити даёт «любл-ю» и
// «любл-енъ», род-ити — «рожд-у» и «рожд-енъ», а у сонорной (твор-, вел-) основа
// не меняется вовсе. Двухбуквенные сочетания разбираются раньше однобуквенных:
// «пуст-ити» даёт «пущ-у», а не «пустл-у».
const IOTATION_PAIRS: [RegExp, string][] = [
    [/ст$/, "щ"], [/ск$/, "щ"], [/зд$/, "жд"],
];
const IOTATION: Record<string, string> = {
    б: "бл", п: "пл", в: "вл", м: "мл",
    д: "жд", т: "щ", з: "ж", с: "ш",
    к: "ч", г: "ж", х: "ш",
};

export const iotate = (stem: string) => {
    const chars = [...stem];
    let last = chars.length - 1;
    while (last >= 0 && COMBINING.test(chars[last])) last--;
    if (last < 0) return stem;

    const head = chars.slice(0, last + 1).join("");
    const tail = chars.slice(last + 1).join("");

    for (const [pattern, replacement] of IOTATION_PAIRS) {
        if (pattern.test(head)) return head.replace(pattern, replacement) + tail;
    }
    const swap = IOTATION[chars[last]];
    return swap ? chars.slice(0, last).join("") + swap + tail : stem;
};

/**
 * Разворачивает сочетание «согласная + плавная + гласная» в настоящем: кла- → кол-,
 * мле- → мел-, бра- → бор-. Гласную задаёт парадигма: V15ol берёт «о», V15el — «е».
 */
export const metathesis = (stem: string, vowel: string) => {
    const chars = [...stem].filter((ch) => !COMBINING.test(ch));
    if (chars.length < 3) return stem;
    const [first, liquid] = chars;
    return `${first}${vowel}${liquid}`;
};

/**
 * Ставит на основу помету снятия омонимии: последнюю «о» меняет на «ѡ», последнюю
 * «е» — на «є». Окончание не трогается вовсе, потому и нужен предел `stemLength`.
 *
 * Это тот же приём, что камора, только другим средством: «а҆́ггелъ» (ед. им.) против
 * «а҆́ггєлъ» (мн. род.), «а҆морре́йска» (ед.) против «а҆моррє́йска» (мн. и дв.). В
 * словаре таких пар 1 856 — и все до одной устроены одинаково: помету несёт
 * множественное или двойственное, единственное остаётся чистым.
 */
export const markStemVowel = (form: string, stemLength: number): string | null => {
    const chars = [...form];
    for (let i = Math.min(stemLength, chars.length) - 1; i >= 0; i--) {
        if (chars[i] === "о") { chars[i] = "ѡ"; return chars.join(""); }
        if (chars[i] === "е") { chars[i] = "є"; return chars.join(""); }
    }
    return null;
};
