import { ObjectId, type Collection } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { TOKENS_DB } from "@/lib/api/v2/tokens";
import { dayKey, decide, type QuotaVerdict } from "@/lib/api/v2/quota";

// Суточный расход ключей.
//
// Минутный лимит живёт в памяти и после перезапуска обнуляется — для окна в минуту это
// не имеет значения. С сутками так нельзя: перезапуск сайта не должен дарить потребителю
// новую суточную квоту, поэтому расход лежит в базе.
//
// Писать в базу на каждый запрос при этом незачем. Расход считается в памяти процесса
// (сайт работает одним процессом под systemd — см. src/lib/rateLimit.ts), а в базу
// сбрасывается отложенно, через полминуты после первого несохранённого запроса, и при
// смене суток. Потерять при падении можно только последние полминуты расхода.
//
// Сброс именно отложенный, а не «по времени на следующем запросе»: всплеск из тысячи
// запросов, после которого клиент умолк, иначе не записался бы вовсе — следующего
// запроса, на котором проверялось бы время, просто не случилось бы.

const USAGE_COLLECTION = "apiTokenUsage";
const FLUSH_INTERVAL_MS = 30_000;

export interface UsageDoc {
    tokenId: ObjectId;
    day: string;
    count: number;
    updatedAt: Date;
}

export const usageCollection = async (): Promise<Collection<UsageDoc>> => {
    const client = await clientPromise;
    return client.db(TOKENS_DB).collection<UsageDoc>(USAGE_COLLECTION);
};

interface Counter {
    day: string;
    count: number;
    /** Что уже записано в базу — чтобы не писать без изменений. */
    saved: number;
}

const counters = new Map<string, Counter>();
const loading = new Map<string, Promise<Counter>>();

let scheduled: ReturnType<typeof setTimeout> | null = null;

const scheduleFlush = () => {
    if (scheduled) return;

    scheduled = setTimeout(() => {
        scheduled = null;
        void flushUsage();
    }, FLUSH_INTERVAL_MS);

    // Незаписанный расход не повод держать процесс живым при остановке.
    scheduled.unref?.();
};

const persist = async (tokenId: string, counter: Counter) => {
    const count = counter.count;
    counter.saved = count;

    try {
        const usage = await usageCollection();
        await usage.updateOne(
            { tokenId: new ObjectId(tokenId), day: counter.day },
            { $set: { count, updatedAt: new Date() } },
            { upsert: true },
        );
    } catch (e) {
        // Расход в памяти при этом остаётся верным — потеряется только запись.
        console.error("api-token usage flush", e);
    }
};

const load = async (tokenId: string, day: string): Promise<Counter> => {
    // Два первых запроса подряд не должны читать базу дважды и терять инкремент.
    const inFlight = loading.get(tokenId);
    if (inFlight) return inFlight;

    const promise = (async () => {
        let count = 0;
        try {
            const usage = await usageCollection();
            const doc = await usage.findOne({ tokenId: new ObjectId(tokenId), day });
            count = doc?.count ?? 0;
        } catch (e) {
            // База недоступна — считаем с нуля, но доступ из-за этого не закрываем.
            console.error("api-token usage load", e);
        }

        const counter: Counter = { day, count, saved: count };
        counters.set(tokenId, counter);
        loading.delete(tokenId);
        return counter;
    })();

    loading.set(tokenId, promise);
    return promise;
};

/** Списывает один запрос из суточной квоты ключа. */
export const spendDaily = async (
    tokenId: ObjectId,
    perDay: number | null,
    now: Date = new Date(),
): Promise<QuotaVerdict> => {
    if (perDay === null) return decide(0, null, now);

    const key = tokenId.toHexString();
    const day = dayKey(now);

    let counter = counters.get(key);
    if (!counter || counter.day !== day) {
        // Смена суток: прежний счётчик дописываем в базу и заводим новый.
        if (counter && counter.count !== counter.saved) await persist(key, counter);
        counters.delete(key);
        counter = await load(key, day);
    }

    const verdict = decide(counter.count, perDay, now);
    if (!verdict.allowed) return verdict;

    counter.count++;
    scheduleFlush();

    return verdict;
};

/** Расход ключа за сегодня — для показа владельцу. */
export const usageToday = async (tokenId: ObjectId, now: Date = new Date()): Promise<number> => {
    const counter = counters.get(tokenId.toHexString());
    if (counter && counter.day === dayKey(now)) return counter.count;

    const usage = await usageCollection();
    const doc = await usage.findOne({ tokenId, day: dayKey(now) });
    return doc?.count ?? 0;
};

/** Дописывает всё накопленное — на случай, если понадобится снять срез немедленно. */
export const flushUsage = async () => {
    for (const [key, counter] of counters) {
        if (counter.count !== counter.saved) await persist(key, counter);
    }
};
