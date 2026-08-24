import { ObjectId, type Collection } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { CacheTag, cached } from "@/lib/cache";
import { slugify, uniqueAlias } from "@/lib/news/format";
import type { NewsPostDTO, NewsStatus, NewsType } from "@/types/dto/news";

// Новости об обновлениях: что появилось в корпусе и что изменилось на сайте.
//
// Отдельная база, а не коллекция в typikon: содержимое корпуса и разговор о корпусе —
// разные вещи. Дампы контента (mongodump/mongorestore --drop, см. release-db.sh)
// накатываются целиком, и новостям в этой карусели делать нечего.

export const NEWS_DB = "typikon-news";
export const NEWS_COLLECTION = "posts";

export interface NewsPost {
    _id: ObjectId;
    alias: string;
    title: string;
    summary: string;
    body: string;
    type: NewsType;
    version: string | null;
    status: NewsStatus;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export const newsCollection = async (): Promise<Collection<NewsPost>> => {
    const client = await clientPromise;
    return client.db(NEWS_DB).collection<NewsPost>(NEWS_COLLECTION);
};

export const serialize = (post: NewsPost): NewsPostDTO => ({
    id: post._id.toString(),
    alias: post.alias,
    title: post.title,
    summary: post.summary,
    body: post.body,
    type: post.type,
    version: post.version,
    status: post.status,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
});

// Черновик не виден нигде, кроме админки: заготовка «выложим, когда доделаем» не
// должна утечь ни в ленту, ни в фид, ни в API.
const PUBLISHED = { status: "published" as const, publishedAt: { $ne: null } };

const readPublished = async (limit: number, offset: number): Promise<[NewsPostDTO[], number]> => {
    const posts = await newsCollection();

    const [items, total] = await Promise.all([
        posts.find(PUBLISHED).sort({ publishedAt: -1 }).skip(offset).limit(limit).toArray(),
        posts.countDocuments(PUBLISHED),
    ]);

    return [items.map(serialize), total];
};

/** Лента опубликованного. Кэшируется тегом: правка в админке сбрасывает его сразу. */
export const listPublished = cached(readPublished, ["news-list"], [CacheTag.NEWS]);

const readOne = async (alias: string): Promise<NewsPostDTO | null> => {
    const posts = await newsCollection();
    const post = await posts.findOne({ ...PUBLISHED, alias });

    return post ? serialize(post) : null;
};

export const getPublished = cached(readOne, ["news-item"], [CacheTag.NEWS]);

const readLatest = async (): Promise<string | null> => {
    const posts = await newsCollection();
    const [post] = await posts.find(PUBLISHED).sort({ publishedAt: -1 }).limit(1).toArray();

    return post?.publishedAt ? post.publishedAt.toISOString() : null;
};

/** Время последней новости — по нему в меню решается, зажигать ли точку «новое». */
export const latestPublishedAt = cached(readLatest, ["news-latest"], [CacheTag.NEWS]);

// --- Правка. Не кэшируется: админка должна видеть базу как она есть.

export const listAll = async (): Promise<NewsPostDTO[]> => {
    const posts = await newsCollection();
    const items = await posts.find({}).sort({ createdAt: -1 }).toArray();

    return items.map(serialize);
};

export interface NewsInput {
    title: string;
    summary?: string;
    body?: string;
    type?: NewsType;
    version?: string | null;
    status?: NewsStatus;
    alias?: string;
}

/** Свободный адрес для новой записи: занятый получает номер. */
const freeAlias = async (wanted: string): Promise<string> => {
    const posts = await newsCollection();
    const base = slugify(wanted);

    const neighbours = await posts
        .find({ alias: { $regex: `^${base}(-\\d+)?$` } }, { projection: { alias: 1 } })
        .toArray();

    return uniqueAlias(base, neighbours.map((post) => post.alias));
};

export const createPost = async (input: NewsInput): Promise<NewsPostDTO> => {
    const posts = await newsCollection();
    const now = new Date();
    const status = input.status ?? "draft";

    const doc: Omit<NewsPost, "_id"> = {
        alias: await freeAlias(input.alias || input.title),
        title: input.title.trim(),
        summary: (input.summary ?? "").trim(),
        body: input.body ?? "",
        type: input.type ?? "update",
        version: input.version?.trim() || null,
        status,
        publishedAt: status === "published" ? now : null,
        createdAt: now,
        updatedAt: now,
    };

    const { insertedId } = await posts.insertOne(doc as NewsPost);

    return serialize({ ...doc, _id: insertedId } as NewsPost);
};

export const updatePost = async (id: string, input: NewsInput & { alias?: string }): Promise<NewsPostDTO | null> => {
    if (!ObjectId.isValid(id)) return null;

    const posts = await newsCollection();
    const current = await posts.findOne({ _id: new ObjectId(id) });
    if (!current) return null;

    const patch: Partial<NewsPost> = { updatedAt: new Date() };

    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.summary !== undefined) patch.summary = input.summary.trim();
    if (input.body !== undefined) patch.body = input.body;
    if (input.type !== undefined) patch.type = input.type;
    if (input.version !== undefined) patch.version = input.version?.trim() || null;

    if (input.alias !== undefined && slugify(input.alias) !== current.alias) {
        patch.alias = await freeAlias(input.alias);
    }

    if (input.status !== undefined && input.status !== current.status) {
        patch.status = input.status;
        // Дата публикации ставится один раз: правка выложенной новости не должна
        // поднимать её обратно наверх ленты и снова зажигать точку у читателей.
        if (input.status === "published" && !current.publishedAt) patch.publishedAt = new Date();
    }

    await posts.updateOne({ _id: new ObjectId(id) }, { $set: patch });

    return serialize({ ...current, ...patch });
};

export const deletePost = async (id: string): Promise<boolean> => {
    if (!ObjectId.isValid(id)) return false;

    const posts = await newsCollection();
    const result = await posts.deleteOne({ _id: new ObjectId(id) });

    return result.deletedCount > 0;
};
