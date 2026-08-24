import { Metadata } from "next";
import Link from "next/link";
import Markdown from "react-markdown";
import { myFont } from "@/utils/font";
import { listPublished } from "@/lib/news/posts";
import { LIST_REVALIDATE } from "@/lib/cache";
import MarkSeen from "@/app/news/MarkSeen";
import type { NewsPostDTO } from "@/types/dto/news";

// Лента новостей: что появилось в корпусе и что изменилось на сайте.
export const revalidate = LIST_REVALIDATE;

export const metadata: Metadata = {
    title: "Новости — Уставные чтения",
    description: "Что нового в корпусе уставных чтений: пополнения, изменения на сайте, выпуски приложения.",
    alternates: { types: { "application/rss+xml": "/rss.xml" } },
};

// Двадцать записей на страницу: в ленте лежит вся история версий с 2023 года, и
// вываливать её целиком незачем — за нею есть страницы.
const PAGE_SIZE = 20;

export const typeLabel: Record<NewsPostDTO["type"], string> = {
    update: "Обновление",
    announcement: "Объявление",
};

export const dateLabel = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "";

const NewsPage = async ({ searchParams }: { searchParams?: { page?: string } }) => {
    const requested = Number(searchParams?.page);
    const page = Number.isFinite(requested) && requested > 1 ? Math.floor(requested) : 1;

    const [items, total] = await listPublished(PAGE_SIZE, (page - 1) * PAGE_SIZE);
    const hasOlder = page * PAGE_SIZE < total;

    return (
        <div className={`${myFont.variable} flex flex-col gap-6 pt-4 pb-8 font-serif`}>
            {/* Заход на первую страницу засчитывается как прочтение — точка гаснет.
                На страницах со старым отмечать нечего: там читают историю. */}
            {page === 1 && <MarkSeen latestPublishedAt={items[0]?.publishedAt ?? null} />}

            <section className="flex flex-col gap-2">
                <h1 className="text-xl font-bold">Новости</h1>
                <p>
                    Что пополнилось в корпусе и что изменилось на сайте. Тем, кто читает через
                    читалки, — <a href="/rss.xml" className="text-amber-800 underline underline-offset-4">RSS</a>.
                </p>
            </section>

            {items.length === 0 ? (
                // Пусто по двум разным поводам: новостей ещё нет вовсе или запрошена
                // страница за концом ленты — читателю это разные сообщения.
                <p className="text-slate-600">{page > 1 ? "Записи кончились." : "Пока пусто."}</p>
            ) : (
                <div className="flex flex-col gap-6">
                    {items.map((item) => (
                        <article key={item.id} className="flex flex-col gap-2 border-l-2 border-slate-300 pl-3">
                            <div className="flex flex-row gap-2 items-baseline flex-wrap text-sm text-slate-600">
                                <time dateTime={item.publishedAt ?? undefined}>{dateLabel(item.publishedAt)}</time>
                                <span>{typeLabel[item.type]}</span>
                                {item.version && <span>версия {item.version}</span>}
                            </div>
                            <h2 className="text-lg font-bold">
                                <Link href={`/news/${item.alias}`} className="hover:underline underline-offset-4">
                                    {item.title}
                                </Link>
                            </h2>
                            <div className="markdown-body">
                                <Markdown>{item.body}</Markdown>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {(hasOlder || page > 1) && (
                <div className="flex flex-row justify-between text-amber-800">
                    {page > 1
                        ? <Link href={page === 2 ? "/news" : `/news?page=${page - 1}`} className="underline underline-offset-4">← Позже</Link>
                        : <span />}
                    {hasOlder && (
                        <Link href={`/news?page=${page + 1}`} className="underline underline-offset-4">Раньше →</Link>
                    )}
                </div>
            )}
        </div>
    );
};

export default NewsPage;
