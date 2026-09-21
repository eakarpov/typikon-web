import captcha from "trek-captcha";

/**
 * Капчи в памяти процесса: сайт работает одним процессом (см. lib/rateLimit).
 *
 * У записи есть срок, у хранилища — предел, а попытка — одна: прежде запись жила
 * вечно, держала буфер картинки и после неверного ответа оставалась на месте,
 * так что одну капчу можно было подбирать сколько угодно, а память — занять
 * запросами с разных адресов. Картинка в записи не хранится: она нужна только
 * в ответе.
 */
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5000;

type Entry = { token: string; expiresAt: number };

// Через global, как соединения с базами: ручка выдачи и ручка проверки — разные
// сборки pages-роутера, и у каждой мог бы оказаться свой экземпляр модуля.
const holder = globalThis as typeof globalThis & { __captchaStore?: Map<string, Entry> };
const store: Map<string, Entry> = holder.__captchaStore ?? (holder.__captchaStore = new Map());

const sweep = (now: number) => {
    for (const [key, entry] of store) {
        if (entry.expiresAt <= now) store.delete(key);
    }
    // Map хранит порядок вставки: сверх предела уходят самые старые.
    while (store.size >= MAX_ENTRIES) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
    }
};

export const generateCaptcha = async (ip: string) => {
    const { token, buffer } = await captcha();
    const now = Date.now();
    sweep(now);
    store.delete(ip);
    store.set(ip, { token, expiresAt: now + TTL_MS });
    return buffer;
};

export type CaptchaVerdict = "ok" | "wrong" | "missing";

/** Одна попытка на капчу: запись снимается при любом исходе. */
export const checkCaptcha = (ip: string, answer: unknown): CaptchaVerdict => {
    const entry = store.get(ip);
    store.delete(ip);
    if (!entry || entry.expiresAt <= Date.now()) return "missing";
    return typeof answer === "string" && answer === entry.token ? "ok" : "wrong";
};
