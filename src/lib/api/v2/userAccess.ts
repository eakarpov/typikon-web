import { fail } from "@/lib/api/v2/http";
import type { Access } from "@/lib/api/v2/access";

// ЧИСТОЕ ПРАВИЛО ЛИЧНОГО ДОСТУПА: что следует из уже полученного права и уже
// прочитанной сессии. Ни куков, ни базы — тем же приёмом, каким `claim.ts`
// вынесен из `commemorators.ts`: правило, которое нельзя проверить отдельно,
// проверяться не будет вовсе.

export interface UserAccess {
    /** Готовый отказ; если он есть, ручке остаётся вернуть его как есть. */
    denied: Response | null;
    /** Заголовки об остатке — их следует вернуть клиенту вместе с данными. */
    headers: Record<string, string>;
    kind: "user";
    /** Хозяин запроса. Пусто, когда `denied` не пуст. */
    userId: string;
}

export const NEED_SESSION =
    "Помянник личный: нужен вход. Ключ отмеряет частоту, а чей список открывать — говорит сессия.";

/**
 * `session.id` — это userId: так заведено в `lib/authorize/sessions`, где документ
 * сессии лежит под ключом пользователя. Читается непривычно, но переименовывать
 * его отсюда нельзя.
 */
export const userAccess = (access: Access, session: unknown): UserAccess => {
    if (access.denied) {
        return { denied: access.denied, headers: {}, kind: "user", userId: "" };
    }

    const id = (session as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || !id) {
        return { denied: fail("session_required", NEED_SESSION), headers: {}, kind: "user", userId: "" };
    }

    return { denied: null, headers: access.headers, kind: "user", userId: id };
};
