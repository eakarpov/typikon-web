import { Metadata } from "next";
import Link from "next/link";
import Markdown from "react-markdown";
import { notFound } from "next/navigation";
import { myFont } from "@/utils/font";
import { getPublished } from "@/lib/news/posts";
import { CONTENT_REVALIDATE } from "@/lib/cache";
import { dateLabel, typeLabel } from "@/app/news/page";

// Отдельный адрес у каждой новости: на неё ссылаются из писем и каналов, и ссылка
// должна вести на саму запись, а не на ленту, где её ещё надо найти.
export const revalidate = CONTENT_REVALIDATE;

export const generateMetadata = async ({ params }: { params: { alias: string } }): Promise<Metadata> => {
    const post = await getPublished(params.alias);

    if (!post) return { title: "Новость не найдена — Уставные чтения" };

    return {
        title: `${post.title} — Уставные чтения`,
        description: post.summary || undefined,
        openGraph: { title: post.title, description: post.summary || undefined, type: "article" },
    };
};

const NewsItemPage = async ({ params }: { params: { alias: string } }) => {
    const post = await getPublished(params.alias);

    if (!post) notFound();

    return (
        <article className={`${myFont.variable} flex flex-col gap-4 pt-4 pb-8 font-serif`}>
            <div className="flex flex-row gap-2 items-baseline flex-wrap text-sm text-slate-600">
                <time dateTime={post.publishedAt ?? undefined}>{dateLabel(post.publishedAt)}</time>
                <span>{typeLabel[post.type]}</span>
                {post.version && <span>версия {post.version}</span>}
            </div>

            <h1 className="text-xl font-bold">{post.title}</h1>

            <div className="markdown-body">
                <Markdown>{post.body}</Markdown>
            </div>

            <Link href="/news" className="text-amber-800 underline underline-offset-4">
                Все новости
            </Link>
        </article>
    );
};

export default NewsItemPage;
