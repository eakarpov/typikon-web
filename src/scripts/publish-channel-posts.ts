// Публикация подтверждённых постов (status = "ready") в момент наступления их слота.
// Запускается по крону дважды в день, в 9:00 и в 18:00 — время слота уже "зашито"
// в scheduledAt каждого поста, отдельно настраивать под утро/вечер не нужно:
// скрипт просто публикует всё, что "просрочено" (scheduledAt <= сейчас) и подтверждено.
//
// Запуск:
//   npm run channel-posts:publish
//
// Нужные переменные окружения:
//   TELEGRAM_BOT_TOKEN  — уже есть в .env.production
//   TELEGRAM_CHANNEL_ID — @username канала или числовой chat_id, бот должен быть администратором
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ChannelPostDTO } from "@/types/dto/channelPost";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

type ChannelPostDoc = Omit<ChannelPostDTO, "id" | "date" | "scheduledAt" | "createdAt" | "updatedAt"> & {
    _id: unknown;
    date: Date;
    scheduledAt: Date;
};

const sendToTelegram = async (post: ChannelPostDoc) => {
    const method = post.imageUrl ? "sendPhoto" : "sendMessage";
    const body = post.imageUrl
        ? { chat_id: CHANNEL_ID, photo: post.imageUrl, caption: post.text, parse_mode: "HTML" }
        : { chat_id: CHANNEL_ID, text: post.text, parse_mode: "HTML", disable_web_page_preview: true };

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
        throw new Error(`Telegram: ${data.description || res.status}`);
    }
    return data.result;
};

// Заглушка — публикация в VK пока не подключена (см. ROADMAP.md: тип сообщества "Канал"
// у @blagoslovie сейчас в закрытой альфе VK API, программная публикация недоступна).
// Когда решится, куда постить (классическая группа/паблик или откроется API каналов) —
// сюда добавляется реальный вызов wall.post, остальной пайплайн менять не придётся:
// targets.vk уже прокинут от генератора и редактируется на странице /admin/channel-posts.
const publishToVk = async (post: ChannelPostDoc) => {
    console.log(`[VK STUB] Публикация ${post._id} в VK не выполнена — интеграция ещё не подключена`);
    return null;
};

const main = async () => {
    if (!BOT_TOKEN || !CHANNEL_ID) {
        throw new Error("Не заданы TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID");
    }

    const client = await clientPromise;
    const db = client.db("typikon");
    const now = new Date();

    const duePosts = await db
        .collection<ChannelPostDoc>("channelPosts")
        .find({ status: "ready", scheduledAt: { $lte: now } })
        .toArray();

    if (!duePosts.length) {
        console.log("Нет подтверждённых постов к публикации");
        process.exit(0);
    }

    for (const post of duePosts) {
        try {
            if (post.targets?.telegram !== false) {
                await sendToTelegram(post);
            }
            if (post.targets?.vk) {
                await publishToVk(post);
            }
            await db
                .collection("channelPosts")
                .updateOne(
                    { _id: post._id },
                    { $set: { status: "published", publishedAt: new Date(), publishError: null } },
                );
            console.log(`Опубликовано: ${post.dayAlias} / ${post.slot}`);
        } catch (e) {
            console.error(`Ошибка публикации ${post._id}:`, e);
            await db
                .collection("channelPosts")
                .updateOne(
                    { _id: post._id },
                    { $set: { status: "failed", publishError: String((e as Error)?.message || e) } },
                );
        }
    }

    process.exit(0);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
