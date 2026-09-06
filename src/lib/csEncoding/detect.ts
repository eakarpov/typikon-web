import { UCS_BYTES } from "@/lib/csEncoding/ucsTable";
import type { Source } from "@/lib/csEncoding/core";

// Догадка о том, чем набран текст, — и почему это именно догадка.
//
// Сказать наверняка нельзя: у HIP и UCS нет ни подписи в начале файла, ни
// расширения, по которому их различают, — оба просто восьмибитный текст. Поэтому
// здесь считаются приметы, и каждая возвращается вместе с числом, на котором
// стоит. Выбор остаётся за человеком: переключатель ставится на верхнюю догадку
// и подписан «предположение», а не «определено».

export interface Guess {
    source: Source;
    /** Доля входа, которую догадка объясняет, 0..1. */
    share: number;
    /** Доказательства, по-русски и с числами. */
    evidence: string[];
}

// Разметка HIP: ASCII-надстрочные и служебные знаки. Восьмибитный HIP отличается
// от юникодного тем, что надстрочные записаны апострофом, равенством и тильдой,
// а у orthlib они уже настоящие буквы.
const HIP8_MARKS = /['=~]/g;
const HIP_MARKUP = /\/\/|\{[^}]{0,40}\}|<::|%[([]|\\[а-яa-z]|_[а-яa-z]/gi;

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

export const guess = (bytes: Uint8Array): Guess[] => {
    const total = bytes.length || 1;
    let high = 0;   // 0x80–0xBF: у UCS здесь стоят буквы с надстрочными
    let cyrillic = 0;   // 0xC0–0xFF: кириллица CP1251
    let ascii = 0;
    for (const b of bytes) {
        if (b >= 0xc0) cyrillic += 1;
        else if (b >= 0x80) high += 1;
        else ascii += 1;
    }

    const text = new TextDecoder("windows-1251").decode(bytes);
    const hipMarks = count(text, HIP8_MARKS);
    const hipMarkup = count(text, HIP_MARKUP);
    const share = (n: number) => Math.min(1, n / total);

    const guesses: Guess[] = [
        {
            source: "ucs",
            // У UCS верхняя половина занята буквами с надстрочными: их там столько
            // же, сколько в тексте ударений, то есть много.
            share: share(high * 4 + cyrillic * 0.2),
            evidence: [
                `${high.toLocaleString("ru")} ${high === 1 ? "байт" : "байтов"} в верхней половине таблицы `
                    + `(${Math.round((high / total) * 100)}% текста) — у UCS там стоят буквы с надстрочными`,
                `${UCS_BYTES.filter(Boolean).length} мест раскладки известны`,
            ],
        },
        {
            source: "hip8",
            share: share(hipMarks * 3 + hipMarkup * 3),
            evidence: [
                `${hipMarks.toLocaleString("ru")} ASCII-надстрочных (' = ~) — так HIP записывает `
                    + "ударение, звательце и титло",
                `${hipMarkup.toLocaleString("ru")} мест издательской разметки (// { } <:: _б \\д)`,
                high === 0 ? "верхняя половина таблицы пуста — на UCS не похоже" : "",
            ].filter(Boolean),
        },
        {
            source: "hip",
            // Юникодный HIP с orthlib: разметка та же, но байты — UTF-8, то есть
            // кириллица приезжает парами 0xD0/0xD1.
            share: share(hipMarkup * 3 + (isUtf8(bytes) ? total * 0.3 : 0)),
            evidence: [
                isUtf8(bytes) ? "байты складываются в правильный UTF-8" : "на UTF-8 не похоже",
                `${hipMarkup.toLocaleString("ru")} мест издательской разметки HIP`,
            ],
        },
    ];

    return guesses.sort((a, b) => b.share - a.share);
};

// Проверка «это правильный UTF-8» — по строению последовательностей, а не по
// удаче декодера: TextDecoder молча подставляет U+FFFD и на мусоре.
const isUtf8 = (bytes: Uint8Array): boolean => {
    let i = 0;
    let multibyte = 0;
    while (i < bytes.length) {
        const b = bytes[i];
        if (b < 0x80) { i += 1; continue; }
        const len = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 0;
        if (!len || i + len > bytes.length) return false;
        for (let k = 1; k < len; k++) {
            if ((bytes[i + k] & 0xc0) !== 0x80) return false;
        }
        multibyte += 1;
        i += len;
    }
    return multibyte > 0;
};
