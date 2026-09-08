import { authorize } from "@/lib/api/v2/access";
import { getSession } from "@/lib/authorize/sessions";
import { userAccess, type UserAccess } from "@/lib/api/v2/userAccess";
import type { Scope } from "@/lib/api/v2/tokens";

// ЛИЧНЫЕ РУЧКИ v2: ключ И сессия, а не ключ ИЛИ сессия.
//
// Публичные разделы спрашивают одно — по каким правам к нам пришли (access.ts).
// Помяннику этого мало: ключ говорит, СКОЛЬКО можно, а сессия — ЧЕЙ список
// открывать. Своим ключом чужой помянник не открыть ни при каком тарифе, и
// наоборот: сессия без ключа не отменяет счётчиков.
//
// ПОРЯДОК ЖЁСТКИЙ: сперва ключ, потом сессия. Наоборот нельзя — `getSession`
// ходит в коллекцию `sessions`, и проверка сессии первой сделала бы мишенью
// базу вместо счётчика в памяти: аноним, долбящий личный адрес, оплачивался бы
// чтением из Mongo на каждый запрос.
//
// АНОНИМУ — `unauthorized`, а не `session_required`, и это следствие того, что
// `pomyannik` не входит в FREE_SCOPES: он упирается в ворота ключа раньше, чем
// доходит до сессии. Так и надо: «войдите» тому, кто и постучаться не вправе, —
// ответ не о том.
//
// Само правило — в userAccess.ts, чтобы его можно было проверить без базы.

export { userAccess, type UserAccess } from "@/lib/api/v2/userAccess";

/**
 * Пропускает запрос или возвращает готовый отказ.
 *
 * `readSession` подменяется тестом: настоящий ходит в куки и в базу, а проверять
 * надо порядок, а не Mongo.
 */
export const authorizeUser = async (
    request: Request,
    scope: Scope,
    readSession: () => Promise<unknown> = getSession,
): Promise<UserAccess> => {
    const access = await authorize(request, scope);
    if (access.denied) return userAccess(access, null);

    // `getSession` делает `new ObjectId(session.sessionId)` и на подписанном токене
    // с мусором в теле бросает. Это отказ во входе, а не поломка сервера: пятисотый
    // тут увёл бы отладку в сторону от подделанной куки.
    let session: unknown = null;
    try {
        session = await readSession();
    } catch {
        session = null;
    }

    return userAccess(access, session);
};
