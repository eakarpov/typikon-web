import {checkAndSaveChannelPost} from "./checkPost";
import { generationOptions } from "./generationOptions";
export { generationOptions } from "./generationOptions";
import { Db, ObjectId } from "mongodb";
import { channelPostsDb } from "@/lib/channelPosts/db";
import { getMonth } from "@/lib/common/date";
import { getZeroedNumber } from "@/utils/dates";
import { buildChannelPost } from "@/scripts/lib/buildPost";
import { ChannelPostSlot } from "@/types/dto/channelPost";

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3000";

// Разница между новым (григорианским) и старым (юлианским) стилем в XXI веке
const OLD_STYLE_OFFSET_DAYS = 13;
const toOldStyle = (date: Date): Date => new Date(+date - OLD_STYLE_OFFSET_DAYS * 24 * 60 * 60 * 1000);

const dayAliasFor = (date: Date) => `${getMonth(date.getUTCMonth() + 1)}-${getZeroedNumber(date.getUTCDate())}`;

// Слоты 9:00/18:00 — это московское время (аудитория канала), а не время сервера. Москва не
// переходит на летнее/зимнее время (всегда UTC+3), поэтому просто явно считаем через Date.UTC —
// не полагаемся на системный часовой пояс процесса (setHours брал бы локальный TZ сервера,
// из-за чего 18:00 могло реально сохраниться как 21:00 или другое время в зависимости от TZ сервера).
const MOSCOW_UTC_OFFSET_HOURS = 3;
const withMoscowTime = (date: Date, moscowHours: number): Date =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), moscowHours - MOSCOW_UTC_OFFSET_HOURS, 0, 0, 0));

/**
 * День берётся у самого сайта, а не из базы, — и это единственное место, где
 * скрипт зависит от того, что сайт поднят и отвечает.
 *
 * Прежде и недоступный сайт, и отказ ручки, и день без чтений сводились к одному
 * `null`, а `null` вёл к тихому выходу с нулевым кодом. Крон при этом молчал, и
 * поломка (ручка дня отвечала 400 из-за упёршейся в предел памяти агрегации)
 * выглядела как «сегодня нечего публиковать» — ровно столько, сколько никто не
 * смотрел в базу. Поэтому «не ответил» — это исключение, а «ответил, но чтений
 * нет» — обычный ход дела.
 */
const fetchDay = async (alias: string): Promise<any> => {
    let res: Response;
    try {
        res = await fetch(`${API_BASE_URL}/api/v1/days/${alias}`, { signal: AbortSignal.timeout(30_000) });
    } catch (e) {
        throw new Error(`${API_BASE_URL} не отвечает (${(e as Error).message}). Сайт поднят?`);
    }
    if (!res.ok) {
        throw new Error(`${API_BASE_URL}/api/v1/days/${alias} ответил ${res.status}`);
    }
    return res.json();
};

const generateForDate = async (db: Db, deliveryDate: Date) => {
    const alias = dayAliasFor(toOldStyle(deliveryDate));
    const day = await fetchDay(alias);
    const items = (day?.song6?.items || []).filter((i: any) => i?.text);

    if (!items.length) {
        console.log(`${alias}: проложных чтений нет — пропускаю`);
        return 0;
    }

    let created = 0;
    const picked = items.slice(0, 2);
    const slots: { item: any; slot: ChannelPostSlot; scheduledAt: Date }[] =
        picked.length === 1
            ? [{ item: picked[0], slot: "morning", scheduledAt: withMoscowTime(deliveryDate, 9) }]
            : [
                  {
                      item: picked[0],
                      slot: "evening",
                      scheduledAt: withMoscowTime(new Date(+deliveryDate - 24 * 60 * 60 * 1000), 18),
                  },
                  { item: picked[1], slot: "morning", scheduledAt: withMoscowTime(deliveryDate, 9) },
              ];

    for (const { item, slot, scheduledAt } of slots) {
        const existing = await db.collection("channelPosts").findOne({
            dayAlias: alias,
            slot,
            sourceTextId: item.text._id,
        });
        if (existing) continue;

        const built = await buildChannelPost({ day, item, dayAlias: alias });

        const post = {
            dayAlias: alias,
            date: deliveryDate,
            slot,
            scheduledAt,
            ...built,
            status: "draft",
            targets: { telegram: true, vk: false },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const inserted = await db.collection("channelPosts").insertOne(post);
        await checkAndSaveChannelPost(db, {...post, _id: inserted.insertedId});

        created++;
        console.log(`Черновик создан: ${alias} / ${slot} / ${built.sourceTextName}`);
    }
    return created;
};

/** Общая точка входа для npm и админки; блокировка действует между процессами. */
export async function generateChannelPosts(options: ReturnType<typeof generationOptions>) {
    const db = await channelPostsDb();
    const locks = db.collection<{ _id: string; token: ObjectId; expiresAt: Date }>("channelPostJobs");
    const token = new ObjectId();
    const now = new Date();
    try {
        await locks.updateOne({ _id: "generate", expiresAt: { $lte: now } }, {
            $set: { token, expiresAt: new Date(+now + 30 * 60_000) },
        }, { upsert: true });
    } catch (error) {
        if ((error as { code?: number }).code === 11000) throw new Error("Генерация уже выполняется. Повторите позже.");
        throw error;
    }
    let created = 0;
    try {
        for (let i = 0; i <= options.daysAhead; i++) {
            created += await generateForDate(db, new Date(+options.from + i * 86_400_000));
        }
        return { created, days: options.daysAhead + 1 };
    } finally {
        await locks.deleteOne({ _id: "generate", token });
    }
}
