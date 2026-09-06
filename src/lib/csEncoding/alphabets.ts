// Вставленный текст — это байты, уже пропущенные через чей-то декодер.
//
// Файл отдаёт байты как есть, и с ним всё просто. Вставка — другое дело: пока
// текст шёл со страницы через буфер обмена в наше окно, браузер уже прочёл его
// какой-то кодовой страницей, и до нас доехали НЕ байты набора, а знаки, в
// которые та страница их превратила. Чтобы вернуться к байтам, надо обратить
// именно этот декодер — а не заводить вторую таблицу UCS с ключами-знаками:
// две таблицы одного и того же неминуемо разойдутся.
//
// ВОЗВРАЩАЕТСЯ НЕ ВСЁ. Байт, которому в промежуточной странице не нашлось знака,
// потерян ещё до нас, и вставкой его не воскресить. Такие места считаются и
// показываются числом: «столько-то знаков потерялось раньше, чем текст попал
// сюда» — честнее, чем подставить похожее.

export type AlphabetId = "cp1251" | "cp1252" | "latin1" | "mac-cyrillic" | "latin-ext";

export interface Alphabet {
    id: AlphabetId;
    label: string;
    /** Чем эта догадка узнаётся: по каким знакам видно, что текст шёл так. */
    note: string;
    toBytes(text: string): { bytes: Uint8Array; unknown: number };
}

// Таблицы кодовых страниц не набираем руками, а обращаем платформенный декодер:
// он есть и в браузере, и в Node, и расходиться с самим собой не умеет.
const invert = (label: string): Map<string, number> => {
    const decoder = new TextDecoder(label);
    const map = new Map<string, number>();
    for (let b = 0; b < 256; b++) {
        const ch = decoder.decode(Uint8Array.of(b));
        // Первый победил: неопределённые байты приходят одним и тем же U+FFFD,
        // и последний затёр бы собою настоящую запись.
        if (!map.has(ch)) map.set(ch, b);
    }
    return map;
};

const byTable = (id: AlphabetId, label: string, encoding: string, note: string): Alphabet => {
    let table: Map<string, number> | undefined;
    return {
        id,
        label,
        note,
        toBytes(text) {
            table ??= invert(encoding);
            const bytes = new Uint8Array(text.length);
            let n = 0;
            let unknown = 0;
            for (const ch of text) {
                const b = table.get(ch);
                if (b === undefined) {
                    unknown += 1;
                    continue;
                }
                bytes[n++] = b;
            }
            return { bytes: bytes.slice(0, n), unknown };
        },
    };
};

// Пятая азбука — не кодовая страница, а раскладка самого шрифта: некоторые ЦС-шрифты
// объявляют свои знаки в латинском расширенном блоке, и текст из такого набора
// доезжает буквами вроде «ļ», «ũ», «Ź». Для кириллической половины соотношение
// постоянное — код знака равен байту плюс 0x7C (0xC0 → U+013C ļ, 0xFD → U+0179 Ź);
// для верхней половины, где стоят буквы с надстрочными, закономерности нет, и
// выводить её из головы нельзя: угаданная перекодировка портит текст правдоподобно.
// Поэтому такие знаки считаются неразобранными, а не подставляются наугад.
const LATIN_EXT_SHIFT = 0x7c;

const latinExt: Alphabet = {
    id: "latin-ext",
    label: "Латинский расширенный (раскладка шрифта)",
    note: "в тексте стоят ļ, ũ, Ź и подобные — так выглядит ЦС-шрифт, прочитанный "
        + "как латиница. Разобрана только кириллическая половина.",
    toBytes(text) {
        const bytes = new Uint8Array(text.length);
        let n = 0;
        let unknown = 0;
        for (const ch of text) {
            const cp = ch.codePointAt(0)!;
            if (cp < 0x80) {
                bytes[n++] = cp;
                continue;
            }
            const b = cp - LATIN_EXT_SHIFT;
            if (b >= 0xc0 && b <= 0xff) {
                bytes[n++] = b;
                continue;
            }
            unknown += 1;
        }
        return { bytes: bytes.slice(0, n), unknown };
    },
};

export const ALPHABETS: readonly Alphabet[] = [
    byTable("cp1251", "Windows-1251 (обычное дело)", "windows-1251",
        "самый частый случай: страница отдавала кириллицу, браузер её и прочёл"),
    byTable("cp1252", "Windows-1252", "windows-1252",
        "текст выглядит набором латинских букв с диакритикой и знаков вроде «‰», «†»"),
    byTable("latin1", "ISO-8859-1", "iso-8859-1",
        "то же, но без верхней тридцатки: на месте «€» и «‰» стоят управляющие знаки"),
    byTable("mac-cyrillic", "Mac Cyrillic", "x-mac-cyrillic",
        "текст пришёл из старых маковских программ"),
    latinExt,
];

export const alphabetOf = (id: AlphabetId): Alphabet =>
    ALPHABETS.find((a) => a.id === id) ?? ALPHABETS[0];
