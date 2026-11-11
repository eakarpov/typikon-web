import type {Db, ObjectId} from "mongodb";
import {checkChannelPostForTelegram, TelegramPostInput} from "./telegram";

/** Сохраняем результат только для той версии текста, которую действительно проверили. */
export const checkAndSaveChannelPost = async (db: Db, post: TelegramPostInput & {_id: ObjectId}) => {
    const telegramCheck = await checkChannelPostForTelegram(post, process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHANNEL_ID);
    const result = await db.collection("channelPosts").updateOne({
        _id: post._id, text: post.text, imageUrl: post.imageUrl ?? null, sourceTextId: post.sourceTextId ?? null,
    }, {$set: {telegramCheck}});
    if (!result.matchedCount) throw new Error("Пост изменился во время проверки. Запустите проверку ещё раз.");
    return telegramCheck;
};
