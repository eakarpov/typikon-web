// Выдача наружу: чем кодировать готовый текст.
//
// Внутри браузера строка и так UTF-16, так что вопрос не в том, «в чём она у
// нас», а в том, что получит программа, которая откроет файл. Спрашивают об
// этом обычно ради Word и старых windows-программ, и им нужна метка порядка
// байтов: без неё Word читает файл как CP1251 и показывает мусор — ровно тот,
// от которого читатель сюда и пришёл.

export type OutEncoding = "utf-8" | "utf-8-bom" | "utf-16le";

export const OUT_LABELS: Record<OutEncoding, string> = {
    "utf-8": "UTF-8",
    "utf-8-bom": "UTF-8 с меткой (BOM)",
    "utf-16le": "UTF-16 LE с меткой (BOM)",
};

export const OUT_NOTES: Record<OutEncoding, string> = {
    "utf-8": "для всего, что новее двухтысячных: браузеры, редакторы, Unix.",
    "utf-8-bom": "для Word и старых windows-программ: без метки они гадают и обычно "
        + "гадают на CP1251. В Unix метка иногда мешает — видна первой строкой.",
    "utf-16le": "для программ, которые просят «юникод» и не понимают UTF-8: "
        + "старые версии Word, Блокнот, часть издательских пакетов.",
};

export const encodeText = (text: string, encoding: OutEncoding): Uint8Array => {
    if (encoding === "utf-16le") {
        // TextEncoder умеет только UTF-8, поэтому собираем руками.
        //
        // charCodeAt отдаёт кодовые ЕДИНИЦЫ UTF-16, а не кодовые точки, и это
        // здесь именно то, что нужно: суррогатная пара сама собой переносится
        // двумя единицами. Обход через for..of или codePointAt пришлось бы
        // разбирать обратно на пары — то есть делать работу, уже сделанную.
        const out = new Uint8Array(2 + text.length * 2);
        out[0] = 0xff;
        out[1] = 0xfe;
        for (let i = 0; i < text.length; i++) {
            const unit = text.charCodeAt(i);
            out[2 + i * 2] = unit & 0xff;
            out[3 + i * 2] = unit >>> 8;
        }
        return out;
    }

    const body = new TextEncoder().encode(text);
    if (encoding === "utf-8") return body;

    const out = new Uint8Array(3 + body.length);
    out.set([0xef, 0xbb, 0xbf]);
    out.set(body, 3);
    return out;
};

export const MIME: Record<OutEncoding, string> = {
    "utf-8": "text/plain;charset=utf-8",
    "utf-8-bom": "text/plain;charset=utf-8",
    "utf-16le": "text/plain;charset=utf-16le",
};

/**
 * Переводы строк по-виндовски.
 *
 * Не по догадке о читателе, а по самому входу: если в исходных байтах стоял
 * CRLF, текст пришёл из-под Windows, и возвращать его туда с одним переводом
 * строки значит отдать Блокноту одну длинную строку.
 */
export const withCrlf = (text: string): string => text.replace(/\r?\n/g, "\r\n");
