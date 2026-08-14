// Генерация черновиков постов для Telegram/VK на основе проложных чтений (song6) дня.
// Запускается по крону ежедневно, готовит черновики вперёд (по умолчанию на 3 дня),
// чтобы оставалось время на ручную проверку перед публикацией.
//
// Запуск (см. также README крона в ROADMAP.md):
//   npm run channel-posts:generate
//   npm run channel-posts:generate -- --days-ahead=5
//   npm run channel-posts:generate -- --from=2026-08-20
//
// Логика выбора:
//   - память дня = day.song6.items (проложные чтения), берутся только первые две, если их больше;
//   - 1 память -> один пост в 9:00 в день D;
//   - 2 памяти -> первая публикуется в 18:00 накануне (D-1), вторая в 9:00 в день D
//     (вечерняя служба уже относится к следующему по Уставу дню);
//   - если черновик для (dayAlias, slot, sourceTextId) уже существует — не трогаем его,
//     чтобы не затереть уже отредактированные/подтверждённые/опубликованные посты.
import "@/scripts/lib/env";
import { Db } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { getMonth } from "@/lib/common/date";
import { getZeroedNumber } from "@/utils/dates";
import { buildChannelPost } from "@/scripts/lib/buildPost";
import { ChannelPostSlot } from "@/types/dto/channelPost";

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3000";

const dayAliasFor = (date: Date) => `${getMonth(date.getMonth() + 1)}-${getZeroedNumber(date.getDate())}`;

const withTime = (date: Date, hours: number): Date => {
    const d = new Date(date);
    d.setHours(hours, 0, 0, 0);
    return d;
};

const parseArgs = () => {
    const args = Object.fromEntries(
        process.argv
            .slice(2)
            .filter((a) => a.startsWith("--"))
            .map((a) => a.replace(/^--/, "").split("=")),
    );
    return {
        daysAhead: Number(args["days-ahead"] || 3),
        from: args.from ? new Date(args.from) : new Date(),
    };
};

const fetchDay = async (alias: string): Promise<any | null> => {
    const res = await fetch(`${API_BASE_URL}/api/v1/days/${alias}`);
    if (!res.ok) return null;
    return res.json();
};

const generateForDate = async (db: Db, date: Date) => {
    const alias = dayAliasFor(date);
    const day = await fetchDay(alias);
    const items = (day?.song6?.items || []).filter((i: any) => i?.text);

    if (!items.length) return;

    const picked = items.slice(0, 2);
    const slots: { item: any; slot: ChannelPostSlot; scheduledAt: Date }[] =
        picked.length === 1
            ? [{ item: picked[0], slot: "morning", scheduledAt: withTime(date, 9) }]
            : [
                  {
                      item: picked[0],
                      slot: "evening",
                      scheduledAt: withTime(new Date(+date - 24 * 60 * 60 * 1000), 18),
                  },
                  { item: picked[1], slot: "morning", scheduledAt: withTime(date, 9) },
              ];

    for (const { item, slot, scheduledAt } of slots) {
        const existing = await db.collection("channelPosts").findOne({
            dayAlias: alias,
            slot,
            sourceTextId: item.text._id,
        });
        if (existing) continue;

        const built = await buildChannelPost({ day, item, dayAlias: alias });

        await db.collection("channelPosts").insertOne({
            dayAlias: alias,
            date,
            slot,
            scheduledAt,
            ...built,
            status: "draft",
            targets: { telegram: true, vk: false },
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        console.log(`Черновик создан: ${alias} / ${slot} / ${built.sourceTextName}`);
    }
};

const main = async () => {
    const { daysAhead, from } = parseArgs();
    const client = await clientPromise;
    const db = client.db("typikon");

    for (let i = 0; i <= daysAhead; i++) {
        const date = new Date(+from + i * 24 * 60 * 60 * 1000);
        await generateForDate(db, date);
    }

    process.exit(0);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
