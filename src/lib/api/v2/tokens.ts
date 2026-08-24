import { createHash, randomBytes } from "node:crypto";
import type { ObjectId } from "mongodb";

// Правила доступа к публичному API: кто спрашивает и что ему за это полагается.
//
// Модуль намеренно чистый — ни базы, ни ответов, — поэтому проверяется тестами целиком.
// Хранение ключей лежит в tokenStore.ts, применение правил к запросу — в access.ts.
//
// Зачем они, если корпус и так под CC BY 4.0: дело не в секретности данных, а в нагрузке.
// Счётчик по адресу защищает плохо — адрес меняется, а отключить одного потребителя,
// не задев остальных, им нельзя вовсе. Ключ даёт и то, и другое, и заодно позволяет
// выдать разным клиентам разную порцию доступа.
//
// Сам ключ в базе не хранится — только sha256 от него. Дамп базы доступа не даёт;
// обратная сторона в том, что показать владельцу ключ второй раз мы не можем, и это
// прямо сказано в интерфейсе выпуска.

export const TOKENS_DB = "typikon-users";
export const TOKENS_COLLECTION = "apiTokens";

/** Разделы API, которые можно выдавать по отдельности. */
export const SCOPES = ["texts", "calendar", "pericopes", "search"] as const;
export type Scope = (typeof SCOPES)[number];

/** Поиск идёт по 12 млн символов и стоит на порядок дороже прочего — его выдаём отдельно. */
export const FREE_SCOPES: readonly Scope[] = ["texts", "calendar", "pericopes"];
export const ALL_SCOPES: readonly Scope[] = SCOPES;

export type Tier = "free" | "app" | "partner";

export interface Allowance {
    /** Сколько запросов разрешено в окне. */
    limit: number;
    /** Длина окна в секундах. */
    windowSeconds: number;
    /** Потолок за сутки; null — без суточного потолка. */
    perDay: number | null;
    scopes: readonly Scope[];
    /**
     * Считать минутный лимит для каждого клиента отдельно, а не на ключ целиком.
     * Нужно ключам, которые зашиты в приложение и общие для всех его пользователей:
     * иначе один пользователь с плохой сетью выбирает лимит на всех.
     */
    perClient: boolean;
}

// Тарифы. Минутный лимит держит всплески, суточный — медленную равномерную выкачку;
// поодиночке ни один из них не работает: 30 в минуту это 43 тысячи запросов в сутки.
export const TIERS: Record<Tier, Allowance> = {
    // Рядовой ключ, который пользователь заводит себе сам в профиле. 30 в минуту хватает
    // на сборку страницы в несколько запросов, 10 тысяч в сутки — на личного бота или
    // приложение для прихода, но не на зеркало корпуса в один поток.
    free: { limit: 30, windowSeconds: 60, perDay: 10_000, scopes: ALL_SCOPES, perClient: false },
    // Наше приложение: ключ один на всех пользователей, поэтому минутный лимит
    // считается по устройству, а суточный — общий и большой.
    app: { limit: 60, windowSeconds: 60, perDay: 500_000, scopes: ALL_SCOPES, perClient: true },
    // Договорённость с конкретным потребителем; частности правятся прямо в ключе.
    partner: { limit: 120, windowSeconds: 60, perDay: 100_000, scopes: ALL_SCOPES, perClient: false },
};

/** Свои страницы: те же 120 в минуту, что и были у API до появления ключей. */
export const SITE_ALLOWANCE: Allowance = {
    limit: 120, windowSeconds: 60, perDay: null, scopes: ALL_SCOPES, perClient: true,
};

/**
 * Без ключа. Настолько, чтобы попробовать ручку из документации и написать первый
 * запрос, и не настолько, чтобы на этом жить: за ключом идти всё равно придётся.
 */
export const ANONYMOUS_ALLOWANCE: Allowance = {
    limit: 60, windowSeconds: 3600, perDay: null, scopes: FREE_SCOPES, perClient: true,
};

export interface ApiToken {
    _id: ObjectId;
    /** sha256 от ключа, шестнадцатеричный. */
    hash: string;
    /** Начало ключа — чтобы владелец узнал свой в списке. */
    prefix: string;
    name: string;
    /** Кто завёл; null — выдан скриптом (приложение, партнёр). */
    userId: string | null;
    tier: Tier;
    // Частные значения перекрывают тариф: «этому дать больше» не должно требовать нового тарифа.
    limit?: number;
    windowSeconds?: number;
    perDay?: number | null;
    scopes?: Scope[];
    perClient?: boolean;
    createdAt: Date;
    lastUsedAt?: Date;
    expiresAt?: Date | null;
    revokedAt?: Date | null;
}

export const TOKEN_PREFIX = "tk_";
/** Длины хватает, чтобы перебор не имел смысла: 32 случайных байта. */
const SECRET_BYTES = 32;

/** Новый ключ. Возвращается открытым один раз — дальше в базе только его хэш. */
export const generateToken = (): string => `${TOKEN_PREFIX}${randomBytes(SECRET_BYTES).toString("base64url")}`;

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Показываемая часть ключа: приставка и первые символы секрета. */
export const tokenPrefix = (token: string): string => `${token.slice(0, TOKEN_PREFIX.length + 6)}…`;

/**
 * Ключ из заголовка Authorization. Признаём и голый ключ без «Bearer»: половина
 * клиентов пришлёт его так, а отвечать им 401 из-за формы записи — недружелюбно.
 */
export const readBearer = (headers: Headers): string | null => {
    const raw = headers.get("authorization")?.trim();
    if (!raw) {
        // Запасной ход для мест, где заголовок Authorization занят прокси.
        const header = headers.get("x-api-key")?.trim();
        return header && header.startsWith(TOKEN_PREFIX) ? header : null;
    }

    const value = /^bearer\s+/i.test(raw) ? raw.replace(/^bearer\s+/i, "").trim() : raw;
    return value.startsWith(TOKEN_PREFIX) ? value : null;
};

/** Тариф плюс частные поправки. Чистая функция — вся настройка доступа собрана здесь. */
export const allowanceFor = (token: Pick<ApiToken, "tier" | "limit" | "windowSeconds" | "perDay" | "scopes" | "perClient">): Allowance => {
    const base = TIERS[token.tier] ?? TIERS.free;

    return {
        limit: token.limit ?? base.limit,
        windowSeconds: token.windowSeconds ?? base.windowSeconds,
        // perDay === null означает «без потолка» и должен перекрывать тариф,
        // поэтому проверяем именно undefined, а не ложность.
        perDay: token.perDay === undefined ? base.perDay : token.perDay,
        scopes: token.scopes ?? base.scopes,
        perClient: token.perClient ?? base.perClient,
    };
};

export type TokenState = "ok" | "revoked" | "expired";

/** Годен ли ключ прямо сейчас. Отдельно от поиска в базе — ради тестов и ясности отказа. */
export const tokenState = (token: Pick<ApiToken, "revokedAt" | "expiresAt">, now = new Date()): TokenState => {
    if (token.revokedAt) return "revoked";
    if (token.expiresAt && token.expiresAt.getTime() <= now.getTime()) return "expired";
    return "ok";
};

const DEFAULT_SITE_ORIGINS = ["https://typikon.su", "https://www.typikon.su"];

export const siteOrigins = (): string[] => {
    const configured = process.env.SITE_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
    if (configured?.length) return configured;

    return process.env.NODE_ENV === "development"
        ? [...DEFAULT_SITE_ORIGINS, "http://localhost:3000", "https://localhost:3000"]
        : DEFAULT_SITE_ORIGINS;
};

/**
 * Запрос со своих страниц. Ключа у них быть не может: всё, что попало в клиентский JS,
 * публично по определению. Признаём их по Sec-Fetch-Site — этот заголовок ставит сам
 * браузер, и менять его скриптам запрещено.
 *
 * Отсутствие заголовка означает «клиент не браузер», а не «свой», поэтому проверяем
 * наличие значения, а не подставляем умолчание. Curl, конечно, может назваться своим:
 * заголовки подделываются. Смысл различения не в этом — своим полагается ровно тот же
 * счётчик по адресу, что был у API до появления ключей, и подделка ничего не выигрывает.
 */
export const isSiteRequest = (headers: Headers, origins: string[] = siteOrigins()): boolean => {
    const fetchSite = headers.get("sec-fetch-site");
    if (fetchSite === "same-origin") return true;
    if (fetchSite === "cross-site" || fetchSite === "none") return false;

    // same-site (например, www и голый домен) и старые браузеры без заголовка —
    // разбираем по источнику.
    const origin = headers.get("origin") ?? headers.get("referer");
    if (!origin) return false;

    try {
        return origins.includes(new URL(origin).origin);
    } catch {
        return false;
    }
};
