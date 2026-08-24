export type NewsType = "update" | "announcement";
export type NewsStatus = "draft" | "published";

export interface NewsPostDTO {
    id: string;
    alias: string;
    title: string;
    /** Короткое изложение: лента, RSS и описание страницы берут его отсюда. */
    summary: string;
    /** Тело в markdown. */
    body: string;
    type: NewsType;
    /** Версия сайта или приложения, если новость про выпуск. */
    version: string | null;
    status: NewsStatus;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
