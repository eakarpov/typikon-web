/** Общая очередь календарных запросов: у движка два рабочих слота.
 * Одинаковые запросы разных страниц делят одно выполнение, но не кэш ответа. */
export function requestQueue(capacity: number) {
    let active = 0;
    const waiting: (() => void)[] = [], inFlight = new Map<string, Promise<unknown>>();
    return {
        run<T>(key: string, work: () => Promise<T>): Promise<T> {
            const existing = inFlight.get(key);
            if (existing)
                return existing as Promise<T>;
            const result = (async () => {
                if (active >= capacity)
                    await new Promise<void>(resolve => waiting.push(resolve));
                else
                    active++;
                try {
                    return await work();
                }
                finally {
                    const next = waiting.shift();
                    if (next)
                        next();
                    else
                        active--;
                }
            })();
            inFlight.set(key, result);
            void result.finally(() => inFlight.delete(key)).catch(() => { });
            return result;
        }
    };
}
