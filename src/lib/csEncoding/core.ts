import { normalizeHip, type Stats } from "@/lib/csEncoding/hip";
import { UCS_BYTES, UCS_UNDEFINED } from "@/lib/csEncoding/ucsTable";
import { plural } from "@/utils/plural";

// Единая точка перекодировки: байты набора → юникод.
//
// Байты, а не строка, и это главное решение раздела. Файл отдаёт их сам;
// вставленный текст возвращается к ним через ./alphabets. Дальше дорога одна,
// и таблица одна — сколько бы ни было способов ввода.

export type Source =
    /** Раскладка шрифта UCS: байт = место в шрифте. */
    | "ucs"
    /** HIP в исходном восьмибитном виде: CP1251 плюс ASCII-надстрочные. */
    | "hip8"
    /** HIP, каким его отдаёт orthlib: буквы уже юникодом, разметка осталась. */
    | "hip";

export interface ConvertResult {
    text: string;
    /** Что именно сделано, по-русски: ключ → сколько раз. */
    stats: Stats;
    /** Сноски, вынутые из текста (у HIP они в фигурных скобках). */
    footnotes: string[];
    /** Куски, выброшенные сознательно: шапки издания и прочее не наше. */
    dropped: string[];
}

export const SOURCE_LABELS: Record<Source, string> = {
    ucs: "UCS — раскладка шрифта",
    hip8: "HIP восьмибитный",
    hip: "HIP с orthlib",
};

// Разметка HIP: по ней видно, что текст всё-таки не готовый юникод.
const HIP_MARKUP = /['=~]|\/\/|<::|\\[а-яa-z]/gi;

/**
 * Текст уже в юникоде?
 *
 * Самая частая беда таких окон — второй прогон: юникодный текст, пропущенный
 * через таблицу ещё раз, портится необратимо и правдоподобно. Дешевле отказать.
 * Признак — знаки, которых в дореформенном наборе быть не может: титло, покрытие,
 * звательце и выносные буквы юникодного блока.
 *
 * Но одного знака мало. HIP с orthlib наполовину юникодный: буквы там настоящие,
 * а надстрочные записаны ASCII, — и случайное титло в таком файле не повод
 * отказать в работе. Поэтому отказ снимается, если рядом стоит разметка HIP.
 */
export const alreadyUnicode = (text: string): boolean => {
    if (!/[҃-҉ⷠ-ⷿ]/.test(text)) return false;
    return (text.match(HIP_MARKUP) ?? []).length < 3;
};

const decodeCp1251 = (bytes: Uint8Array) => new TextDecoder("windows-1251").decode(bytes);

// Что считать сделанной работой: байт, у которого раскладка отобрала одно
// начертание и дала другое. Пропущенные насквозь в счёт не идут — иначе отчёт
// хвалился бы тем, что не трогал.
const ucsToUnicode = (bytes: Uint8Array): ConvertResult => {
    const stats: Stats = {};
    const out: string[] = [];
    const plain = decodeCp1251(bytes);

    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        const mapped = UCS_BYTES[b];
        if (b === UCS_UNDEFINED) {
            stats["пустых мест в раскладке"] = (stats["пустых мест в раскладке"] ?? 0) + 1;
        } else if (mapped !== plain[i]) {
            stats["знаков переложено"] = (stats["знаков переложено"] ?? 0) + 1;
        }
        out.push(mapped);
    }

    // NFC в конце, как у HIP: иначе одно и то же слово ляжет в собрание двумя
    // разными строками и перестанет находиться.
    return { text: out.join("").normalize("NFC"), stats, footnotes: [], dropped: [] };
};

/** Перекодировка байтов набора. */
export const convertBytes = (bytes: Uint8Array, source: Source): ConvertResult => {
    if (source === "ucs") return ucsToUnicode(bytes);

    const raw = source === "hip8" ? decodeCp1251(bytes) : new TextDecoder("utf-8").decode(bytes);
    const { content, footnotes, dropped, stats } = normalizeHip(raw, { hip8: source === "hip8" });
    return { text: content, stats, footnotes, dropped };
};

const FORMS: Record<string, [string, string, string]> = {
    "знаков переложено": ["знак переложен", "знака переложено", "знаков переложено"],
    "пустых мест в раскладке": ["пустое место в раскладке", "пустых места в раскладке", "пустых мест в раскладке"],
    буквы: ["буква", "буквы", "букв"],
    выносные: ["выносная", "выносные", "выносных"],
    ударения: ["ударение", "ударения", "ударений"],
    звательца: ["звательце", "звательца", "звательцев"],
    титла: ["титло", "титла", "титл"],
    числа: ["числовой знак", "числовых знака", "числовых знаков"],
    сноски: ["сноска", "сноски", "сносок"],
    строки: ["разрыв строки", "разрыва строки", "разрывов строк"],
    вставки: ["издательская вставка", "издательские вставки", "издательских вставок"],
    выделение: ["выделение", "выделения", "выделений"],
    колонтитулы: ["колонтитул", "колонтитула", "колонтитулов"],
    глоссы: ["глосса", "глоссы", "глосс"],
    шапка: ["шапка издания", "шапки издания", "шапок издания"],
    проценты: ["знак процента", "знака процента", "знаков процента"],
};

/**
 * Отчёт о сделанном, строками.
 *
 * Печатается под выводом, а не прячется: перекодировка — это правка чужого
 * текста, и читатель вправе знать, чего в нём коснулись и сколько раз.
 */
export const report = (stats: Stats): string[] =>
    Object.entries(stats)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([key, n]) => {
            const forms = FORMS[key];
            return forms ? `${n.toLocaleString("ru")} ${plural(n, ...forms)}` : `${key}: ${n.toLocaleString("ru")}`;
        });
