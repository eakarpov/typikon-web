// Разбор песнопения на то, к чему привязывается напев: колена и слоги.
//
// Ударения НЕ ищем в словаре: текст корпуса уже размечен — книги печатают
// «услы́ши», «Го́споди», — и снимать разметку, чтобы восстановить её словарём,
// значило бы заменить свидетельство догадкой. Словарь пригодится там, где
// текст пришёл без знаков (@/lib/accents), здесь он не нужен.

import { isAccent, isCombining, isVowel, unfoldPrecomposed } from "@/lib/accents/core";

export interface Syllable {
    text: string;
    stressed: boolean;
    /** Слог начинает слово: по нему восстанавливаются границы слов, стёртые
     *  делением. Нужны обеим нотациям — и подтекстовке под нотами, и просветам
     *  между словами в крюковой строке. */
    wordStart: boolean;
}

export interface Colon {
    syllables: Syllable[];
    /** Знак, которым колено кончилось: показываем его при последнем слоге. */
    trailing: string;
}

// Колена размечает КНИГА, и только она: косой чертой (двойной — перед
// последним) или звёздочкой. Догадаться о них по пунктуации нельзя, и это
// проверено на обоих разобранных гласах, причём промахи разного рода.
//
// Глас 1 стихирный: запятая ДРОБИТ лишнее — «утверди́ Правосла́вием Це́рковь
// Твою́, Христе́,» книга поёт одним коленом, а разбор по запятой делает из него
// два, и порядок строк съезжает до конца песнопения.
//
// Глас 3 тропарный: запятая НЕ ДЕЛИТ там, где надо — между «держа́ву» и
// «мы́шцею» знака нет вовсе, книга делит по смыслу, и три колена из восьми
// достаются не своей строке.
//
// Поэтому напев показывается только там, где разметка есть (см. Tune.tsx), а
// здесь остаётся честное деление по разметке: нет её — весь текст одно колено.
const COLON_MARK = /[/*]+/;

/** Разметил ли книжный набор колена: без неё напев класть не на что. */
export const hasColonMarkup = (text: string): boolean => /[/*]/.test(text);

// Знак, которым колено кончилось: показываем его при последнем слоге.
const COLON_END = /[,.;:!?»]/;

/** Деление на колена — по книжной разметке, и ни по чему иному. */
export const splitColons = (text: string): string[] => {
    const source = text.trim();
    if (!source) return [];
    return source.split(COLON_MARK).map(p => p.trim()).filter(Boolean);
};

const LETTER_OR_MARK = /[\p{L}̀-ͯ҃-҉꙯]/u;

// Сонорные: только они закрывают слог перед шумной согласной («се́рд-це»,
// «пол-ка́»). Остальные сочетания шумных уходят к следующему слогу целиком.
const SONORANTS = "рлмнй";

/**
 * Деление слова на слоги.
 *
 * Правило открытого слога с поправкой на сонорные — то самое, по которому
 * русскую и церковнославянскую речь делят с Аванесова.
 *
 * Сочетание согласных между гласными отходит к СЛЕДУЮЩЕМУ слогу целиком:
 * «Го-спо-ди», «у-слы-ши», «во-ззва́хъ». Так эти слова и распеваются на
 * клиросе; деление по-письменному («Гос-по-ди») дало бы под нотой закрытый
 * слог, которого певчий не поёт.
 *
 * Но сонорные, стоящие в начале сочетания, остаются при своей гласной, если за
 * ними есть ещё согласная: «се́рд-це», «со́лн-це», «ца́р-ствїе» — «рдц», «лнц» и
 * «рств» в начале слога не произносятся. Из одних сонорных сочетание уходит к
 * следующему слогу целиком, как и всякое другое: «во-лна́».
 *
 * Согласные после последней гласной остаются при ней: «ми-лость», а не
 * «ми-ло-сть». Ъ и ь самостоятельного слога не образуют — они не гласные и
 * попадают в согласную часть сами собой.
 *
 * Морфологию правило не знает: «пита́ющихся» делится на «пи-та́-ю-щи-хся», а не
 * «щих-ся», потому что «хс» — две шумные. Для распева это безразлично (нот всё
 * равно столько же), а для подтекстовки под нотами — вопрос вкуса издателя.
 *
 * Слово без гласных вовсе («въ», «къ») слогом не является: возвращаем его
 * одним куском, а приклеит его к соседу тот, кто раскладывает (см. ниже).
 */
export const splitWord = (word: string): string[] => {
    const chars = [...word];
    const letters: number[] = [];
    const vowelAt: number[] = [];
    for (let i = 0; i < chars.length; i++) {
        if (isCombining(chars[i])) continue;
        letters.push(i);
        if (isVowel(chars[i])) vowelAt.push(i);
    }
    if (vowelAt.length <= 1) return [word];

    const cuts: number[] = [];
    for (let v = 0; v < vowelAt.length - 1; v++) {
        // Режем сразу за диакритикой текущей гласной и всем, что к ней
        // приросло: ударение и звательце принадлежат своей букве, и отрывать
        // их нельзя — слог осыплется голым знаком в начале следующего.
        let cut = vowelAt[v] + 1;
        while (cut < chars.length && isCombining(chars[cut])) cut++;

        // Согласные до следующей гласной — стечение, которое надо поделить.
        const cluster = letters.filter(i => i >= cut && i < vowelAt[v + 1]);
        let sonorous = 0;
        while (sonorous < cluster.length && SONORANTS.includes(chars[cluster[sonorous]].toLowerCase())) {
            sonorous++;
        }
        // Сонорные закрывают слог только тогда, когда за ними осталась
        // согласная: иначе делить нечего, и сочетание уходит дальше целиком.
        if (sonorous > 0 && sonorous < cluster.length) cut = cluster[sonorous];
        cuts.push(cut);
    }

    const parts: string[] = [];
    let from = 0;
    for (const cut of cuts) {
        parts.push(chars.slice(from, cut).join(""));
        from = cut;
    }
    parts.push(chars.slice(from).join(""));
    return parts.filter(Boolean);
};

const hasStress = (part: string) => [...unfoldPrecomposed(part)].some(isAccent);

/**
 * Слоги колена, по порядку, с пометкой ударных.
 *
 * Безгласные слова («въ», «къ», «съ») приклеиваются к следующему слогу:
 * отдельной ноты они не получают — их и не поют отдельно.
 */
export const colonSyllables = (colon: string): Syllable[] => {
    const out: Syllable[] = [];
    let pending = "";

    for (const token of colon.split(/\s+/).filter(Boolean)) {
        // Пунктуацию к слогу не приписываем: она не поётся, а под нотой
        // выглядела бы частью слова.
        const word = [...token].filter(ch => LETTER_OR_MARK.test(ch)).join("");
        if (!word) continue;

        const parts = splitWord(word);
        const voiced = parts.some(p => [...p].some(ch => isVowel(ch) && !isCombining(ch)));
        if (!voiced) {
            pending += word;
            continue;
        }

        parts.forEach((part, i) => {
            const text = i === 0 ? pending + part : part;
            if (i === 0) pending = "";
            out.push({ text, stressed: hasStress(part), wordStart: i === 0 });
        });
    }

    // Безгласный хвост колена приклеивать не к чему — отдаём его последнему
    // слогу, чтобы текст не потерялся молча.
    if (pending && out.length) out[out.length - 1].text += pending;
    return out;
};

/** Полный разбор песнопения: колена со слогами. */
export const parseChantText = (text: string): Colon[] =>
    splitColons(text).map(colon => {
        const trailing = COLON_END.test(colon.slice(-1)) ? colon.slice(-1) : "";
        return { syllables: colonSyllables(colon), trailing };
    }).filter(c => c.syllables.length > 0);
