import { ObjectId, type Collection } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { TOKENS_COLLECTION, TOKENS_DB, hashToken, type ApiToken } from "@/lib/api/v2/tokens";

// Хранение ключей. Сам ключ в базе не лежит — только sha256 от него: дамп базы доступа
// не даёт. Обратная сторона в том, что показать владельцу ключ второй раз мы не можем,
// и это прямо сказано в интерфейсе выпуска.

export const tokensCollection = async (): Promise<Collection<ApiToken>> => {
    const client = await clientPromise;
    return client.db(TOKENS_DB).collection<ApiToken>(TOKENS_COLLECTION);
};

// Кэш поиска по хэшу. Ключ проверяется на каждом запросе к API, а меняется он редко;
// без кэша это лишний поход в Mongo на каждый запрос. Промахи кэшируются тоже — иначе
// подбор ключа превращается в нагрузку на базу.
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 1000;

interface CacheEntry {
    token: ApiToken | null;
    at: number;
}

const cache = new Map<string, CacheEntry>();

/** Сбрасывает кэш: отзыв ключа должен действовать сразу, а не через полминуты. */
export const forgetCachedTokens = () => cache.clear();

/** Ключ по открытому значению или null, если такого нет. Отзыв и срок здесь не проверяются. */
export const findToken = async (plain: string): Promise<ApiToken | null> => {
    const hash = hashToken(plain);
    const now = Date.now();

    const hit = cache.get(hash);
    if (hit && now - hit.at < CACHE_TTL_MS) return hit.token;

    const token = await (await tokensCollection()).findOne({ hash });

    if (cache.size >= CACHE_MAX) {
        // Карта упорядочена по вставке — выкидываем самое старое.
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(hash, { token, at: now });

    return token;
};

// Отметка о последнем использовании нужна владельцу («этим ключом ещё пользуются?»),
// но писать её на каждый запрос — лишняя запись в базу. Раз в пять минут достаточно.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const touched = new Map<string, number>();

export const touchToken = (id: ObjectId) => {
    const key = id.toHexString();
    const now = Date.now();

    if (now - (touched.get(key) ?? 0) < TOUCH_INTERVAL_MS) return;
    touched.set(key, now);

    tokensCollection()
        .then((tokens) => tokens.updateOne({ _id: id }, { $set: { lastUsedAt: new Date() } }))
        .catch((e) => console.error("api-token touch", e));
};
