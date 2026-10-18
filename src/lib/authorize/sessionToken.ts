import { jwtVerify, type JWTPayload } from "jose";
import type { Document, ObjectId } from "mongodb";

export interface StoredSession extends Document {
    _id: ObjectId;
    id: string;
    expiresAt: Date;
    createdAt?: Date;
}

export interface SessionPayload extends JWTPayload {
    sessionId: string;
    userId: string;
}

/**
 * Подпись доказывает происхождение cookie, запись в базе — действующий вход.
 * Не кэшируем: удалённая сессия должна перестать открывать доступ уже на
 * следующем запросе. Lookup передаётся отдельно, чтобы проверять отзыв без Mongo.
 */
export const resolveSessionToken = async (
    token: string | undefined,
    key: Uint8Array,
    findSession: (id: string) => Promise<StoredSession | null>,
    now: Date = new Date(),
): Promise<{ payload: SessionPayload; session: StoredSession } | null> => {
    if (!token || !key.length) return null;

    let payload: JWTPayload;
    try {
        ({ payload } = await jwtVerify(token, key, {
            algorithms: ["HS256"],
            requiredClaims: ["exp"],
            currentDate: now,
        }));
    } catch {
        return null;
    }

    if (typeof payload.sessionId !== "string" || !/^[a-f\d]{24}$/i.test(payload.sessionId)
        || typeof payload.userId !== "string" || !payload.userId.trim()) return null;

    // Сбой базы пробрасывается вызывающему: это не разрешение доступа и не
    // повод молча считать подпись достаточной.
    const session = await findSession(payload.sessionId);
    if (!session || session.id !== payload.userId
        || !(session.expiresAt instanceof Date)
        || !Number.isFinite(session.expiresAt.getTime())
        || session.expiresAt.getTime() <= now.getTime()) return null;

    return { payload: payload as SessionPayload, session };
};
