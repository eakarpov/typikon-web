/**
 * Пределы для полей тела запроса у ручек, которые пишут присланное в базу.
 * Вошедшему пользователю доверяют содержание, но не размер и не вид: строка
 * должна быть строкой, а вложенный объект — небольшим.
 */
export const isText = (value: unknown, max: number): value is string =>
    typeof value === "string" && value.trim().length > 0 && value.length <= max;

export const isOptionalText = (value: unknown, max: number): boolean =>
    value == null || (typeof value === "string" && value.length <= max);

/** Идентификатор или alias текста: короткая строка без управляющих знаков. */
export const isId = (value: unknown): value is string =>
    typeof value === "string" && /^[\w.:-]{1,128}$/.test(value);

/** Небольшой объект без вложенных операторов Mongo (`$…`) в ключах. */
export const isSmallObject = (value: unknown, maxBytes: number): boolean => {
    if (!value || typeof value !== "object") return false;
    let json: string;
    try {
        json = JSON.stringify(value);
    } catch {
        return false;
    }
    return json.length <= maxBytes && !/"\$[^"]*":/.test(json);
};
