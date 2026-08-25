import {ObjectId} from "mongodb";

// Разбор списка текстов, приходящего от приложения.
//
// Вынесено из ручки отдельно, потому что это единственное место, где список
// приходит извне пачкой: при первом входе приложение присылает всё избранное,
// накопленное на устройстве. Остальные ручки работают с одним textId.

// Верхняя граница на одно слияние. Реальный список — десятки текстов; всё, что
// заметно больше, это либо ошибка клиента, либо попытка забить коллекцию.
// Молча обрезать нельзя: пользователь решил бы, что избранное перенеслось.
export const MAX_MERGE_IDS = 500;

export class TooManyFavouritesError extends Error {
    constructor(readonly count: number) {
        super(`Получено ${count} текстов, предел ${MAX_MERGE_IDS}`);
    }
}

/**
 * Приводит присланный список к тому, что можно писать в базу: только строковые
 * ObjectId, без повторов и без пустых значений.
 *
 * Мусор среди идентификаторов отбрасывается, а не роняет весь запрос: список
 * копился на устройстве годами и мог пережить не одну версию приложения —
 * из-за одной битой записи человек не должен терять всё остальное.
 */
export const normaliseTextIds = (input: unknown): string[] => {
    if (!Array.isArray(input)) return [];
    if (input.length > MAX_MERGE_IDS) throw new TooManyFavouritesError(input.length);

    const seen = new Set<string>();
    for (const value of input) {
        if (typeof value !== "string") continue;
        const trimmed = value.trim();
        if (!ObjectId.isValid(trimmed)) continue;
        seen.add(trimmed);
    }
    return [...seen];
};
