/**
 * Выражения разметки чтений — одни на все места, где она разбирается
 * (страница чтения, чтение в составе дня, случайное чтение).
 *
 * Прежде у каждого места были свои, и три из них — жадные: `/\{pl\|(.+)}/`.
 * Две метки одного рода в абзаце сливались в одну: киноварь красила всё между
 * двумя указаниями, а из двух мест выходила одна ссылка с подписью
 * «Афины} и {pl». По дампу корпуса таких абзацев 23. Тело метки не содержит
 * закрывающей скобки — это и записано: `[^}]+`.
 *
 * В каждом выражении ровно одна группа: так требует react-string-replace.
 */
export const SAINT_MARK = /\{st\|([^}]+)}/g;
export const PLACE_MARK = /\{pl\|([^}]+)}/g;
export const RED_MARK = /\{k\|([^}]+)}/g;
export const FOOTNOTE_MARK = /\{(\d+)}/g;

/** Тело метки-ссылки: «адрес|подпись»; подпись необязательна. */
export const splitLinkMark = (body: string): { id: string; label: string } => {
    const bar = body.indexOf("|");
    if (bar < 0) return { id: body.trim(), label: body.trim() };
    const id = body.slice(0, bar).trim();
    return { id, label: body.slice(bar + 1).trim() || id };
};
