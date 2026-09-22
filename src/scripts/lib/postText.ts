// Счёт знаков и обрезка текста поста. Вынесено из buildPost отдельным модулем:
// правила проверяются тестами, а buildPost тянет за собой и базу, и сеть.

/**
 * Пределы Telegram — в знаках РАЗОБРАННОГО текста.
 *
 * Разница между ними и есть причина всей этой арифметики: пост с картинкой
 * уходит подписью к ней, а подпись вчетверо короче обычного сообщения. Прежде
 * тело резалось по 3200 знакам сырой разметки — числу, которое к пределу
 * Telegram отношения не имело вовсе, — и пост с картинкой отвергался целиком.
 */
export const CAPTION_LIMIT = 1024;
export const MESSAGE_LIMIT = 4096;

/** Запас на разночтения в счёте: знак многоточия, невидимые мелочи. */
export const LIMIT_MARGIN = 16;

const decodeEntities = (value: string): string =>
    value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");

/**
 * Сколько знаков насчитает Telegram.
 *
 * Разметка не в счёт: `<a href="…">Текст</a>` для него — «Текст». Поэтому мерить
 * длину строки как есть нельзя: у поста со ссылками разница набегает на сотни
 * знаков, и, отмерив по сырой длине, мы отрезали бы куда больше нужного.
 *
 * Теги снимаются ДО расшифровки сущностей, а не после: иначе `&lt;b&gt;`
 * превратился бы в настоящий тег и был бы снят как разметка.
 */
export const visibleLength = (html: string): number =>
    decodeEntities(html.replace(/<[^>]+>/g, "")).length;

const TOKENS = /<[^>]+>|[^<]+/g;

/**
 * Обрезка по словам, с оглядкой на разметку.
 *
 * Два условия, которые нельзя нарушить. Первое: резать по границе слова —
 * оборванное посередине слово читается как опечатка. Второе: не оставить
 * открытым тег. Telegram разбирает разметку сам и на незакрытом `<a>` отвечает
 * отказом — то есть неаккуратный разрез стоил бы всего поста, а не хвоста.
 * Поэтому открытые на месте разреза теги закрываются здесь же.
 */
export const truncateHtmlByWords = (
    html: string,
    budget: number,
): { html: string; truncated: boolean } => {
    if (budget <= 0) return { html: "", truncated: true };
    if (visibleLength(html) <= budget) return { html, truncated: false };

    const open: string[] = [];
    let out = "";
    let used = 0;

    for (const token of html.match(TOKENS) || []) {
        if (token.startsWith("<")) {
            const closing = /^<\/([a-zA-Z]+)/.exec(token);
            const opening = /^<([a-zA-Z]+)/.exec(token);
            if (closing) open.pop();
            else if (opening && !token.endsWith("/>")) open.push(opening[1]);
            out += token;
            continue;
        }

        const length = visibleLength(token);
        if (used + length <= budget) {
            out += token;
            used += length;
            continue;
        }

        // Разрез приходится на этот кусок: набираем его по словам, пока влезает.
        let cut = "";
        for (const piece of token.split(/(\s+)/)) {
            const pieceLength = visibleLength(piece);
            if (used + pieceLength > budget) break;
            cut += piece;
            used += pieceLength;
        }
        out += cut.replace(/\s+$/, "");
        while (open.length) out += `</${open.pop()}>`;
        return { html: `${out}…`, truncated: true };
    }

    return { html: out, truncated: false };
};
