// Чистая логика приведения текстов orthlib (формат HIP) к юникоду нашего корпуса.
// Вынесена отдельно от скрипта, чтобы её можно было звать из split-book и из тестов,
// не поднимая подключение к базе.

const TITLO = "҃";
const OXIA = "́";
const VARIA = "̀";
const KAMORA = "̑";
const THOUSAND = "҂";
// Служебный маркер на время выемки сносок: {комм.} не должен уехать в footnotes.
const KOMM_HOLD = "\uE000";
const FOOT_OPEN = "\uE001";
const FOOT_CLOSE = "\uE002";

export type Stats = Record<string, number>;

export const bump = (stats: Stats, key: string, n: number) => {
    if (n) stats[key] = (stats[key] ?? 0) + n;
};

// Считает и заменяет за один проход, чтобы отчёт не расходился с тем, что реально сделано.
const swap = (
    text: string,
    stats: Stats,
    key: string,
    pattern: RegExp,
    to: string | ((...m: any[]) => string),
) => {
    let n = 0;
    const out = text.replace(pattern, (...args: any[]) => {
        n += 1;
        if (typeof to === "function") return to(...args);
        // Замена приходит функцией, поэтому $1 сам по себе не подставится.
        return to.replace(/\$(\d)/g, (_$, d: string) => args[Number(d)] ?? "");
    });
    bump(stats, key, n);
    return out;
};

// Чистка, одинаковая для тела текста и для текста сноски.
const cleanCommon = (input: string, stats: Stats): string => {
    let s = input;

    // Вставки издателя: диапазон дат, восстановленная буква, вставные скобки.
    s = swap(s, stats, "вставки", /<->/g, "—");
    s = swap(s, stats, "вставки", /<\(\(>/g, "«");
    s = swap(s, stats, "вставки", /<\)\)>/g, "»");
    s = swap(s, stats, "вставки", /<([^<>]{1,3})_>/g, "$1");

    // Разметка выделения переводится в markdown: %(…%) — заголовок статьи указателя,
    // %[…%] — подрубрика внутри статьи. Пробел рядом с звёздочками ломает разбор,
    // поэтому содержимое подрезается; выделение через пустую строку markdown не
    // выражает — такие случаи оставляем текстом.
    const emphasis = (mark: string) => (_m: string, body: string) => {
        const inner = body.trim();
        return !inner || /\n\s*\n/.test(inner) ? inner : `${mark}${inner}${mark}`;
    };
    s = swap(s, stats, "выделение", /%\(([\s\S]*?)%\)/g, emphasis("**"));
    s = swap(s, stats, "выделение", /%\[([\s\S]*?)%\]/g, emphasis("*"));
    s = swap(s, stats, "проценты", /%t/g, "\t");

    // Разрывы строк набора и жёсткие переносы: смысла не несут, абзац собирается заново.
    // Внутри слова разрыв означает перенос без дефиса (1056 случаев в Ифике) — там
    // склеиваем вплотную, иначе «пола//гая» превращается в два слова.
    s = swap(s, stats, "строки", /(\S)\/\/(\S)/g, "$1$2");
    s = swap(s, stats, "строки", /[ \t]*\/\/[ \t]*/g, " ");
    s = s.replace(/\n{3,}/g, "\n\n");
    s = swap(s, stats, "строки", /([^\n])\n(?!\n)/g, "$1 ");

    // Латинские подстановки. Двухбуквенные — раньше однобуквенных.
    s = swap(s, stats, "буквы", /J[Ьь]/g, (m: string) => (m[1] === "Ь" ? "Ѣ" : "ѣ"));
    s = swap(s, stats, "буквы", /J(?=[аА])/g, "Ꙗ").replace(/Ꙗ[аА]/g, "Ꙗ");
    s = swap(s, stats, "буквы", /j(?=[аА])/g, "ꙗ").replace(/ꙗ[аА]/g, "ꙗ");
    s = swap(s, stats, "буквы", /V"/g, "Ѷ");
    s = swap(s, stats, "буквы", /i/g, "і");
    s = swap(s, stats, "буквы", /I/g, "І");
    s = swap(s, stats, "буквы", /f/g, "ѳ");
    s = swap(s, stats, "буквы", /F/g, "Ѳ");
    s = swap(s, stats, "буквы", /W/g, "Ѡ");
    s = swap(s, stats, "буквы", /w/g, "ѡ");
    s = swap(s, stats, "буквы", /S/g, "Ѕ");
    s = swap(s, stats, "буквы", /V/g, "Ѵ");

    // Числа: знак тысячи и диграфы числовых букв.
    s = swap(s, stats, "числа", /#/g, THOUSAND);
    s = swap(s, stats, "числа", /_пс/g, "ѱ");
    s = swap(s, stats, "числа", /_ПС/g, "Ѱ");
    s = swap(s, stats, "числа", /_кс/g, "ѯ");
    s = swap(s, stats, "числа", /_КС/g, "Ѯ");
    s = swap(s, stats, "числа", /_/g, "");

    // Обратный слэш помечает выносную букву: «вл\дкꙋ» — это влⷣкꙋ, «тр\оцы» — трⷪ҇цы,
    // «коне\ц» — конеⷰ. Переводим в юникодные надстрочные буквы (блок U+2DE0),
    // те же, которыми набран остальной корпус. Буквы без надстрочной формы
    // (и, ѣ и подобные) оставляем как есть — их разбирают глазами.
    s = swap(s, stats, "выносные", /\\([бвгджзклмнопрстхцчшщѳаеюꙗ])/g, (_m: string, letter: string) => {
        const SUPERSCRIPT: Record<string, string> = {
            "б": "ⷠ", "в": "ⷡ", "г": "ⷢ", "д": "ⷣ", "ж": "ⷤ", "з": "ⷥ", "к": "ⷦ", "л": "ⷧ",
            "м": "ⷨ", "н": "ⷩ", "о": "ⷪ", "п": "ⷫ", "р": "ⷬ", "с": "ⷭ", "т": "ⷮ", "х": "ⷯ",
            "ц": "ⷰ", "ч": "ⷱ", "ш": "ⷲ", "щ": "ⷳ", "ѳ": "ⷴ", "а": "ⷶ", "е": "ⷷ", "ю": "ⷻ", "ꙗ": "ⷼ",
        };
        return SUPERSCRIPT[letter] ?? `\\${letter}`;
    });

    // Паразитное титло перед ударением.
    s = swap(s, stats, "титла", new RegExp(`${TITLO}(?=${OXIA})`, "g"), "");

    // Ударения, записанные ASCII-заменителями.
    s = swap(s, stats, "ударения", /`/g, VARIA);
    s = swap(s, stats, "ударения", /\^/g, KAMORA);

    return s.normalize("NFC");
};

export const normalizeHip = (
    raw: string,
): { content: string; footnotes: string[]; dropped: string[]; stats: Stats } => {
    const stats: Stats = {};
    let s = raw;

    // Сноски вынимаем первыми: внутри них своя редакционная пометка на русском,
    // и её нельзя спутать с издательской преамбулой, которая ниже удаляется.
    // {комм.} — не сноска, а пометка комментария синодального издания.
    const rawFootnotes: string[] = [];
    s = s.split("{комм.}").join(KOMM_HOLD);
    s = swap(s, stats, "сноски", /\{([^{}]*)\}/g, (_m: string, body: string) => {
        rawFootnotes.push(body);
        return `${FOOT_OPEN}${rawFootnotes.length}${FOOT_CLOSE}`;
    });
    s = s.split(KOMM_HOLD).join("{комм.}");

    // Преамбула OCR и русские издательские блоки — обвязка публикатора, не текст книги.
    // Их содержимое возвращается наружу, чтобы ничего не пропадало молча.
    const dropped: string[] = [];
    s = swap(s, stats, "шапка", /<::(?:лат|рус|рꙋс)>([\s\S]*?)(?=<::слав>)/g, (m: string) => {
        const body = m.replace(/<::[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (body) dropped.push(body);
        return "";
    });
    s = swap(s, stats, "шапка", /<::[^>]*>[ \t]*/g, "");

    s = cleanCommon(s, stats);

    const footnotes = rawFootnotes.map((f) =>
        cleanCommon(f.replace(/<::[^>]*>[ \t]*/g, ""), stats).replace(/\s+/g, " ").trim(),
    );

    // Колонтитулы печатного издания: из потока чтения уходят, привязка остаётся.
    s = swap(s, stats, "колонтитулы", /\(([лс]\.[^)]{1,24})\)/g, (_m: string, body: string) => `{p|${body.trim()}}`);

    s = s.replace(new RegExp(`${FOOT_OPEN}(\\d+)${FOOT_CLOSE}`, "g"), "{$1}");
    // Табуляция значима: ею разделены колонки двух таблиц Ифики, поэтому схлопываем
    // только пробелы и подчищаем пробелы вокруг табуляции и переводов строк.
    s = s.replace(/ {2,}/g, " ").replace(/ *\t */g, "\t").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim();

    return { content: s, footnotes, dropped, stats };
};

// Церковнославянские числа: буква = значение, число = сумма букв.
const DIGITS: Record<string, number> = {
    "а": 1, "в": 2, "г": 3, "д": 4, "є": 5, "е": 5, "ѕ": 6, "з": 7, "и": 8, "ѳ": 9,
    "і": 10, "и́": 10, "к": 20, "л": 30, "м": 40, "н": 50, "ѯ": 60, "ѻ": 70, "о": 70,
    "п": 80, "ч": 90, "р": 100, "с": 200, "т": 300, "ꙋ": 400, "у": 400, "ф": 500,
    "х": 600, "ѱ": 700, "ѡ": 800, "ц": 900,
};

// Титло снимаем, а знак тысячи оставляем: он множит следующую букву на 1000.
const stripMarks = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ҃-҉]/g, "").normalize("NFC");

// Число без титла — не число, а слово: «безъ числа̀» не должно читаться как 341.
export const csNumber = (label: string): number | null => {
    if (!label.includes(TITLO) && !label.includes(THOUSAND)) return null;

    let sum = 0;
    let thousands = false;
    for (const c of stripMarks(label).toLowerCase()) {
        if (c === THOUSAND) {
            thousands = true;
            continue;
        }
        if (!(c in DIGITS)) continue;
        sum += thousands ? DIGITS[c] * 1000 : DIGITS[c];
        thousands = false;
    }
    return sum || null;
};
