import { listPublished } from "@/lib/news/posts";
import { rssXml } from "@/lib/news/format";

// Фид новостей для читалок.
//
// Лежит в корне, а не в /news/rss.xml, хотя логичнее было бы там: рядом с лентой стоит
// /news/[alias], и он перехватывает «rss.xml» как алиас новости — в режиме разработки
// это воспроизводится сразу, как только страница отдельной новости скомпилируется.
// Соседство с динамическим сегментом решено убрать совсем, а не полагаться на то, чей
// маршрут окажется старше.
//
// Ответ собирается на каждый запрос, и это не расточительство: выборка под ним
// кэширована тегом, в базу мы не ходим. Статический вариант проверен и отвергнут —
// прогенерированный на сборке ответ не сбрасывался тегом `news` вместе с лентой и
// продолжал отдавать старый фид, когда новость уже вышла.
export const dynamic = "force-dynamic";

const SITE = "https://www.typikon.su";

// Двадцати записей хватает любой читалке: они показывают последнее, а не архив.
const FEED_SIZE = 20;

export async function GET() {
    const [items] = await listPublished(FEED_SIZE, 0);

    const xml = rssXml(
        items.map((item) => ({
            alias: item.alias,
            title: item.title,
            // В фид уходит изложение, а не тело: markdown в описании читалки покажут как есть.
            summary: item.summary || item.title,
            publishedAt: item.publishedAt!,
        })),
        SITE,
    );

    return new Response(xml, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
