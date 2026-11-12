class Incomplete<T> extends Error {
    constructor(readonly result: T) { super('Temporary incomplete result'); }
}
/** Не кладёт временно неполный ответ в долговременный кэш, но отдаёт его
 * вызывающему для честного сообщения об отсутствующих данных. */
export function cacheComplete<A extends unknown[], T>(work: (...args: A) => Promise<T>, memoize: (work: (...args: A) => Promise<T>) => (...args: A) => Promise<T>, complete: (value: T) => boolean) {
    const cached = memoize(async (...args: A) => { const value = await work(...args); if (!complete(value))
        throw new Incomplete(value); return value; });
    return async (...args: A): Promise<T> => { try {
        return await cached(...args);
    }
    catch (e) {
        if (e instanceof Incomplete)
            return e.result as T;
        throw e;
    } };
}
