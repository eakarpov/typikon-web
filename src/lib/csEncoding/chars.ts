// Имена знаков по-русски — то, чего не даёт ни один готовый справочник.
//
// Полная таблица юникода (UnicodeData.txt) весит около 1,8 МБ, и имена в ней
// английские и читателю бесполезные: «CYRILLIC LETTER YAT» вместо «ять».
// Поэтому здесь выверенный список того, что вправду встречается в
// церковнославянском наборе, — 118 записей на 12 КБ. Чего в списке нет,
// инспектор честно называет кодом и именем блока, а имени не выдумывает.
//
// Чистый словарь: сюда не ходит ничто, кроме данных, и оттого он безопасен
// для клиента — то же правило, что у @/lib/razbor/labels.

import { PUA_TABLE } from "@/lib/csEncoding/pua";

export type CharClass =
    /** Буква гражданского алфавита. */
    | "letter"
    /** Буква, которой в гражданке нет: ѣ, ѧ, ѡ, ꙋ, і, ѵ, ѳ, ѕ, ѯ, ѱ. */
    | "letter-cs"
    /** Ударение: оксия, вария, камора. */
    | "accent"
    /** Придыхание: звательце, дасия. */
    | "spirit"
    /** Титло — знак сокращения. */
    | "titlo"
    /** Выносная буква: написана НАД строкой и в линейный порядок не встаёт. */
    | "superscript"
    /** Покрытие: ставится после выносной. */
    | "pokrytie"
    /** Числовой знак: тысяча, сто тысяч, миллион. */
    | "number"
    /** Прочий надстрочный знак. */
    | "mark"
    | "punct" | "space" | "latin" | "private" | "unknown";

export const CLASS_LABELS: Record<CharClass, string> = {
    letter: "буква",
    "letter-cs": "церковнославянская буква",
    accent: "ударение",
    spirit: "придыхание",
    titlo: "титло",
    superscript: "выносная буква",
    pokrytie: "покрытие",
    number: "числовой знак",
    mark: "надстрочный знак",
    punct: "знак препинания",
    space: "пробел",
    latin: "латинская буква",
    private: "знак из области частного использования",
    unknown: "неизвестный знак",
};

export interface CharInfo {
    cp: number;
    name: string;
    klass: CharClass;
    /** Зачем он нужен и чем отличается от соседа. */
    note?: string;
}

/** Выверенные знаки церковнославянского набора. */
export const CS_CHARS: Record<number, CharInfo> = {
    0x0300: { cp: 0x0300, name: "вария", klass: "accent", note: "тяжёлое ударение: над гласной в конце слова" },
    0x0301: { cp: 0x0301, name: "оксия", klass: "accent", note: "острое ударение" },
    0x0306: { cp: 0x0306, name: "краткая", klass: "mark" },
    0x0307: { cp: 0x0307, name: "точка сверху", klass: "mark" },
    0x0308: { cp: 0x0308, name: "диерезис", klass: "mark" },
    0x030b: { cp: 0x030b, name: "двойная оксия", klass: "accent" },
    0x030f: { cp: 0x030f, name: "двойная вария", klass: "accent" },
    0x0311: { cp: 0x0311, name: "камора", klass: "accent", note: "облечённое ударение: различает единственное число от множественного" },
    0x0313: { cp: 0x0313, name: "запятая сверху", klass: "mark", note: "в церковнославянском наборе обычно вместо звательца — чужой знак" },
    0x033e: { cp: 0x033e, name: "ерок", klass: "mark", note: "заменяет выпавший ер" },
    0x0404: { cp: 0x0404, name: "Есть широкое", klass: "letter-cs" },
    0x0405: { cp: 0x0405, name: "зело прописное", klass: "letter-cs" },
    0x0406: { cp: 0x0406, name: "и десятеричное прописное", klass: "letter-cs" },
    0x0407: { cp: 0x0407, name: "Ї с двумя точками", klass: "letter-cs" },
    0x0450: { cp: 0x0450, name: "ѐ — е с варией", klass: "letter-cs", note: "один знак, а не два: NFC сложила" },
    0x0454: { cp: 0x0454, name: "есть широкое", klass: "letter-cs" },
    0x0455: { cp: 0x0455, name: "зело", klass: "letter-cs" },
    0x0456: { cp: 0x0456, name: "и десятеричное", klass: "letter-cs" },
    0x0457: { cp: 0x0457, name: "ї с двумя точками", klass: "letter-cs" },
    0x045d: { cp: 0x045d, name: "ѝ — и с варией", klass: "letter-cs", note: "один знак, а не два: NFC сложила" },
    0x0460: { cp: 0x0460, name: "омега прописная", klass: "letter-cs" },
    0x0461: { cp: 0x0461, name: "омега", klass: "letter-cs" },
    0x0462: { cp: 0x0462, name: "ять прописная", klass: "letter-cs" },
    0x0463: { cp: 0x0463, name: "ять", klass: "letter-cs" },
    0x0465: { cp: 0x0465, name: "е йотированное", klass: "letter-cs" },
    0x0466: { cp: 0x0466, name: "юс малый прописной", klass: "letter-cs" },
    0x0467: { cp: 0x0467, name: "юс малый", klass: "letter-cs" },
    0x0469: { cp: 0x0469, name: "юс малый йотированный", klass: "letter-cs" },
    0x046a: { cp: 0x046a, name: "юс большой прописной", klass: "letter-cs" },
    0x046b: { cp: 0x046b, name: "юс большой", klass: "letter-cs" },
    0x046e: { cp: 0x046e, name: "кси прописное", klass: "letter-cs" },
    0x046f: { cp: 0x046f, name: "кси", klass: "letter-cs" },
    0x0470: { cp: 0x0470, name: "пси прописное", klass: "letter-cs" },
    0x0471: { cp: 0x0471, name: "пси", klass: "letter-cs" },
    0x0472: { cp: 0x0472, name: "фита прописная", klass: "letter-cs" },
    0x0473: { cp: 0x0473, name: "фита", klass: "letter-cs" },
    0x0474: { cp: 0x0474, name: "ижица прописная", klass: "letter-cs" },
    0x0475: { cp: 0x0475, name: "ижица", klass: "letter-cs" },
    0x0476: { cp: 0x0476, name: "Ижица с ударением", klass: "letter-cs" },
    0x0477: { cp: 0x0477, name: "ижица с ударением", klass: "letter-cs" },
    0x0478: { cp: 0x0478, name: "ук слитный прописной", klass: "letter-cs" },
    0x0479: { cp: 0x0479, name: "ук слитный", klass: "letter-cs" },
    0x047a: { cp: 0x047a, name: "о широкое прописное", klass: "letter-cs" },
    0x047b: { cp: 0x047b, name: "о широкое", klass: "letter-cs" },
    0x047c: { cp: 0x047c, name: "омега великая прописная", klass: "letter-cs" },
    0x047d: { cp: 0x047d, name: "омега великая", klass: "letter-cs" },
    0x047e: { cp: 0x047e, name: "от прописное", klass: "letter-cs" },
    0x047f: { cp: 0x047f, name: "от", klass: "letter-cs" },
    0x0482: { cp: 0x0482, name: "знак тысячи", klass: "number", note: "умножает следующую букву на тысячу" },
    0x0483: { cp: 0x0483, name: "титло", klass: "titlo", note: "знак сокращения: буквы под ним опущены" },
    0x0484: { cp: 0x0484, name: "палатализация", klass: "mark" },
    0x0485: { cp: 0x0485, name: "дасия", klass: "spirit", note: "густое придыхание" },
    0x0486: { cp: 0x0486, name: "звательце", klass: "spirit", note: "тонкое придыхание в начале слова" },
    0x0487: { cp: 0x0487, name: "покрытие", klass: "pokrytie", note: "ставится после выносной буквы" },
    0x0488: { cp: 0x0488, name: "знак ста тысяч", klass: "number" },
    0x0489: { cp: 0x0489, name: "знак миллионов", klass: "number" },
    0x1c80: { cp: 0x1c80, name: "в округлое", klass: "letter-cs", note: "уставное начертание" },
    0x1c81: { cp: 0x1c81, name: "д долгоногое", klass: "letter-cs", note: "уставное начертание" },
    0x1c82: { cp: 0x1c82, name: "о узкое", klass: "letter-cs", note: "в паре с «у» — диграф ук" },
    0x1c83: { cp: 0x1c83, name: "с широкое", klass: "letter-cs", note: "уставное начертание" },
    0x1c84: { cp: 0x1c84, name: "т высокое", klass: "letter-cs", note: "уставное начертание" },
    0x1c85: { cp: 0x1c85, name: "т трёхногое", klass: "letter-cs", note: "уставное начертание" },
    0x1c86: { cp: 0x1c86, name: "ъ высокое", klass: "letter-cs", note: "уставное начертание" },
    0x1c87: { cp: 0x1c87, name: "ять высокая", klass: "letter-cs", note: "уставное начертание" },
    0x1c88: { cp: 0x1c88, name: "ук несведённый", klass: "letter-cs", note: "уставное начертание" },
    0x2de0: { cp: 0x2de0, name: "выносная б", klass: "superscript" },
    0x2de1: { cp: 0x2de1, name: "выносная в", klass: "superscript" },
    0x2de2: { cp: 0x2de2, name: "выносная г", klass: "superscript" },
    0x2de3: { cp: 0x2de3, name: "выносная д", klass: "superscript" },
    0x2de4: { cp: 0x2de4, name: "выносная ж", klass: "superscript" },
    0x2de5: { cp: 0x2de5, name: "выносная з", klass: "superscript" },
    0x2de6: { cp: 0x2de6, name: "выносная к", klass: "superscript" },
    0x2de7: { cp: 0x2de7, name: "выносная л", klass: "superscript" },
    0x2de8: { cp: 0x2de8, name: "выносная м", klass: "superscript" },
    0x2de9: { cp: 0x2de9, name: "выносная н", klass: "superscript" },
    0x2dea: { cp: 0x2dea, name: "выносная о", klass: "superscript" },
    0x2deb: { cp: 0x2deb, name: "выносная п", klass: "superscript" },
    0x2dec: { cp: 0x2dec, name: "выносная р", klass: "superscript" },
    0x2ded: { cp: 0x2ded, name: "выносная с", klass: "superscript" },
    0x2dee: { cp: 0x2dee, name: "выносная т", klass: "superscript" },
    0x2def: { cp: 0x2def, name: "выносная х", klass: "superscript" },
    0x2df0: { cp: 0x2df0, name: "выносная ц", klass: "superscript" },
    0x2df1: { cp: 0x2df1, name: "выносная ч", klass: "superscript" },
    0x2df2: { cp: 0x2df2, name: "выносная ш", klass: "superscript" },
    0x2df3: { cp: 0x2df3, name: "выносная щ", klass: "superscript" },
    0x2df4: { cp: 0x2df4, name: "выносная ѳ", klass: "superscript" },
    0x2df5: { cp: 0x2df5, name: "выносная ст", klass: "superscript" },
    0x2df6: { cp: 0x2df6, name: "выносная а", klass: "superscript" },
    0x2df7: { cp: 0x2df7, name: "выносная е", klass: "superscript" },
    0x2df8: { cp: 0x2df8, name: "выносная ђ", klass: "superscript" },
    0x2df9: { cp: 0x2df9, name: "выносная ꙋ", klass: "superscript" },
    0x2dfa: { cp: 0x2dfa, name: "выносная ѣ", klass: "superscript" },
    0x2dfb: { cp: 0x2dfb, name: "выносная ю", klass: "superscript" },
    0x2dfc: { cp: 0x2dfc, name: "выносная ꙗ", klass: "superscript" },
    0x2dfd: { cp: 0x2dfd, name: "выносная ѧ", klass: "superscript" },
    0x2dfe: { cp: 0x2dfe, name: "выносная ѫ", klass: "superscript" },
    0x2dff: { cp: 0x2dff, name: "выносная ѭ", klass: "superscript" },
    0xa640: { cp: 0xa640, name: "Земля", klass: "letter-cs" },
    0xa641: { cp: 0xa641, name: "земля", klass: "letter-cs" },
    0xa64a: { cp: 0xa64a, name: "ук прописной", klass: "letter-cs" },
    0xa64b: { cp: 0xa64b, name: "ук (монограф)", klass: "letter-cs" },
    0xa64c: { cp: 0xa64c, name: "омега круглая прописная", klass: "letter-cs" },
    0xa64d: { cp: 0xa64d, name: "омега круглая", klass: "letter-cs" },
    0xa650: { cp: 0xa650, name: "Еры", klass: "letter-cs" },
    0xa651: { cp: 0xa651, name: "еры", klass: "letter-cs" },
    0xa656: { cp: 0xa656, name: "Я (юс йотированный)", klass: "letter-cs" },
    0xa657: { cp: 0xa657, name: "я (юс йотированный)", klass: "letter-cs" },
    0xa66f: { cp: 0xa66f, name: "взмет", klass: "mark" },
    0xa673: { cp: 0xa673, name: "славянская звёздочка", klass: "punct" },
    0xa674: { cp: 0xa674, name: "выносная є", klass: "superscript" },
    0xa675: { cp: 0xa675, name: "выносная і", klass: "superscript" },
    0xa676: { cp: 0xa676, name: "выносная ї", klass: "superscript" },
    0xa677: { cp: 0xa677, name: "выносная у", klass: "superscript" },
    0xa678: { cp: 0xa678, name: "выносная ъ", klass: "superscript" },
    0xa679: { cp: 0xa679, name: "выносная ы", klass: "superscript" },
    0xa67c: { cp: 0xa67c, name: "камора (славянская)", klass: "accent" },
    0xa67d: { cp: 0xa67d, name: "паерок", klass: "mark", note: "заменяет выпавший ер" },
    0xa67e: { cp: 0xa67e, name: "кавыка", klass: "punct", note: "отсылка к пометке на поле" },
};

// Частные коды приходят из ./pua — там же, где записано, чем подтверждено
// каждое значение и во что оно сводится. Держать их вторым списком здесь
// значило бы завести две таблицы одного и того же.
for (const entry of PUA_TABLE) {
    CS_CHARS[entry.cp] = {
        cp: entry.cp,
        name: entry.name,
        klass: "private",
        note: entry.to
            ? `юникодное соответствие — ${[...entry.to].map((c) => "U+" + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")).join(" ")}`
            : entry.evidence,
    };
}

/** Блоки юникода, которых хватает, чтобы назвать незнакомый знак хотя бы приблизительно. */
export const BLOCKS: ReadonlyArray<{ from: number; to: number; name: string; klass: CharClass }> = [
    { from: 0x0000, to: 0x007f, name: "латиница и знаки ASCII", klass: "latin" },
    { from: 0x0080, to: 0x00ff, name: "латиница-1", klass: "latin" },
    { from: 0x0100, to: 0x017f, name: "латиница расширенная A", klass: "latin" },
    { from: 0x0180, to: 0x024f, name: "латиница расширенная B", klass: "latin" },
    { from: 0x0300, to: 0x036f, name: "надстрочные знаки", klass: "mark" },
    { from: 0x0370, to: 0x03ff, name: "греческий алфавит", klass: "unknown" },
    { from: 0x0400, to: 0x04ff, name: "кириллица", klass: "letter" },
    { from: 0x0500, to: 0x052f, name: "кириллица дополнительная", klass: "letter" },
    { from: 0x1c80, to: 0x1c8f, name: "кириллица расширенная C", klass: "letter-cs" },
    { from: 0x1dc0, to: 0x1dff, name: "надстрочные знаки дополнительные", klass: "mark" },
    { from: 0x2000, to: 0x206f, name: "знаки препинания", klass: "punct" },
    { from: 0x2de0, to: 0x2dff, name: "кириллица расширенная A: выносные буквы", klass: "superscript" },
    { from: 0xa640, to: 0xa69f, name: "кириллица расширенная B", klass: "letter-cs" },
    { from: 0xe000, to: 0xf8ff, name: "область частного использования", klass: "private" },
    { from: 0xf0000, to: 0xffffd, name: "область частного использования (дополнительная)", klass: "private" },
];

const RUSSIAN = /[\u0410-\u044f\u0401\u0451]/;

// Знаки препинания и цифры латинской части таблицы: без них запятая называлась
// бы «знаком из блока латиницы», то есть неверно по существу.
const ASCII: Record<number, string> = {
    0x21: "восклицательный знак", 0x22: "кавычка", 0x27: "апостроф",
    0x28: "открывающая скобка", 0x29: "закрывающая скобка",
    0x2c: "запятая", 0x2d: "дефис", 0x2e: "точка", 0x2f: "косая черта",
    0x3a: "двоеточие", 0x3b: "точка с запятой", 0x3f: "вопросительный знак",
    0x5b: "открывающая квадратная скобка", 0x5d: "закрывающая квадратная скобка",
    0xab: "открывающая кавычка", 0xbb: "закрывающая кавычка",
    0x2014: "тире", 0x2013: "короткое тире", 0x2026: "многоточие",
};

/** Что известно о знаке. Незнакомый называется блоком, а не выдумкой. */
export const charInfo = (cp: number): CharInfo => {
    const known = CS_CHARS[cp];
    if (known) return known;
    if (RUSSIAN.test(String.fromCodePoint(cp))) {
        return { cp, name: String.fromCodePoint(cp), klass: "letter" };
    }
    if (cp === 0x20 || cp === 0x09 || cp === 0x0a || cp === 0x0d) {
        return { cp, name: cp === 0x20 ? "пробел" : "перевод строки", klass: "space" };
    }
    if (ASCII[cp]) return { cp, name: ASCII[cp], klass: "punct" };
    if (cp >= 0x30 && cp <= 0x39) return { cp, name: `цифра ${String.fromCodePoint(cp)}`, klass: "number" };
    if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) {
        return { cp, name: `латинская ${String.fromCodePoint(cp)}`, klass: "latin" };
    }
    const block = BLOCKS.find((b) => cp >= b.from && cp <= b.to);
    return {
        cp,
        name: block ? `знак из блока «${block.name}»` : "знак вне известных нам блоков",
        klass: block?.klass ?? "unknown",
    };
};
