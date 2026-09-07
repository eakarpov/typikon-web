// Ошибка, случившаяся в браузере, — на сервер. Оборотная сторона reportError:
// та пишет в журнал сама, а эта отправляет ручке /api/client-errors, которая
// её и вызывает. До этого путь наружу был один — граница ошибок страницы
// (src/app/error.tsx), и всё, что перехвачено раньше неё (не загрузился модуль,
// не пришли данные слоя карты), оставалось в консоли посетителя.
//
// Ничего не бросает и ничего не ждёт: сообщение об ошибке не должно становиться
// второй ошибкой.
export const reportClientError = (
    error: unknown,
    where: string,
    extra?: { digest?: string },
): void => {
    if (typeof window === "undefined") return;

    const asError = error instanceof Error ? error : new Error(String(error));

    void fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: asError.name,
            message: asError.message,
            stack: asError.stack,
            digest: extra?.digest,
            where,
        }),
        keepalive: true,
    }).catch(() => {
        // Не доехало — молчим: пользователю от второй ошибки не легче.
    });
};
