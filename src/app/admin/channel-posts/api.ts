import { channelPostsDb } from "@/lib/channelPosts/db";
import {reportError} from "@/lib/reportError";

const toDTO = ({ _id, ...post }: any) => ({ ...post, id: _id.toString() });

/**
 * Список для работы: всё, кроме уже опубликованного.
 *
 * Опубликованные отсюда убраны нарочно. Они не требуют никаких действий, а
 * копились в общем списке и отодвигали вниз то, ради чего страницу открывают, —
 * черновики, которые надо прочитать и подтвердить. Живут они теперь в «Архиве».
 */
export const getItems = async (): Promise<[any[] | null, any]> => {
    try {
        const db = await channelPostsDb();

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const posts = await db
            .collection("channelPosts")
            .find({ scheduledAt: { $gte: since }, status: { $ne: "published" } })
            .sort({ scheduledAt: 1 })
            .limit(50)
            .toArray();

        return [posts.map(toDTO), null];
    } catch (e) {
        reportError(e, { where: "app/admin/channel-posts/api#getItems" });
        return [null, { error: e }];
    }
};

/**
 * Архив: опубликованное, новое сверху.
 *
 * Без ограничения по времени — в отличие от рабочего списка: в архив и ходят
 * затем, чтобы посмотреть или прибрать старое. Сотня записей за раз, дальше
 * чистка.
 */
export const getArchive = async (): Promise<[any[] | null, any]> => {
    try {
        const db = await channelPostsDb();

        const posts = await db
            .collection("channelPosts")
            .find({ status: "published" })
            // publishedAt есть не у всех: посты, опубликованные до того, как поле
            // появилось, встанут по сроку публикации — он у них верный.
            .sort({ publishedAt: -1, scheduledAt: -1 })
            .limit(100)
            .toArray();

        return [posts.map(toDTO), null];
    } catch (e) {
        reportError(e, { where: "app/admin/channel-posts/api#getArchive" });
        return [null, { error: e }];
    }
};
