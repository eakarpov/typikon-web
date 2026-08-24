import "server-only";

// Единая точка, куда попадают ошибки сервера и клиента.
//
// Сейчас пишет структурированную строку в stdout: под systemd её подбирает journald,
// и `journalctl -u typikon-web | grep typikon-error` даёт разбираемый JSON вместо
// россыпи разноформатных console.error по 143 местам.
//
// Когда появится Sentry (или что-то подобное), подключать его нужно ровно здесь —
// одна функция вместо правки всех мест, где ловится ошибка.

export type ErrorSource = "server" | "client" | "api" | "script";

export interface ErrorContext {
    /** Где произошло: маршрут, ручка, имя операции. */
    where: string;
    source?: ErrorSource;
    /** Что угодно полезное для разбора: id документа, параметры запроса. */
    extra?: Record<string, unknown>;
}

const serialize = (error: unknown) => {
    if (error instanceof Error) {
        return { name: error.name, message: error.message, stack: error.stack };
    }
    if (typeof error === "object" && error !== null) {
        try {
            return { message: JSON.stringify(error) };
        } catch {
            return { message: String(error) };
        }
    }
    return { message: String(error) };
};

export const reportError = (error: unknown, context: ErrorContext) => {
    const payload = {
        tag: "typikon-error",
        at: new Date().toISOString(),
        source: context.source ?? "server",
        where: context.where,
        ...serialize(error),
        ...(context.extra ? { extra: context.extra } : {}),
    };

    // Одной строкой: journald не склеивает многострочные записи, а разбирать
    // распавшийся на строки JSON потом невесело.
    console.error(JSON.stringify(payload));

    // Место для внешнего сборщика:
    // if (process.env.SENTRY_DSN) { ... }
};
