'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { hasUnread } from "@/lib/news/format";
import {
    CHECK_INTERVAL_MS,
    NEWS_CHECKED_KEY,
    NEWS_LATEST_KEY,
    NEWS_SEEN_EVENT,
    NEWS_SEEN_KEY,
    readStorage,
    writeStorage,
} from "@/lib/news/seen";

// Пункт меню с точкой «новое».
//
// Точка нужна затем же, зачем и сами новости: страница, на которую надо догадаться
// зайти, не сообщает ни о чём. При этом:
//
//   * пришедшему впервые точка не загорается — он ничего не пропустил, и горящая у
//     всех и всегда точка перестала бы что-либо значить. Первое посещение просто
//     запоминает нынешнюю новость как отправную;
//   * сервер спрашивается не чаще раза в полчаса, а не на каждой странице: узнаём мы
//     этим запросом одну дату.

const NewsLink = () => {
    const pathname = usePathname();
    const [unread, setUnread] = useState(false);

    const refresh = useCallback(async () => {
        let latest = readStorage(NEWS_LATEST_KEY);
        const checkedAt = Number(readStorage(NEWS_CHECKED_KEY) ?? 0);

        if (Date.now() - checkedAt >= CHECK_INTERVAL_MS) {
            try {
                // no-store, потому что ответ ручки кэшируется на десять минут: без
                // этого браузер отдал бы прошлый ответ, и точка загоралась бы позже,
                // чем вышла новость. Раз в полчаса такой запрос ничего не стоит.
                const res = await fetch("/api/v2/news?limit=1", { cache: "no-store" });
                const data = res.ok ? await res.json() : null;

                latest = data?.items?.[0]?.publishedAt ?? null;
                writeStorage(NEWS_CHECKED_KEY, String(Date.now()));
                if (latest) writeStorage(NEWS_LATEST_KEY, latest);
            } catch {
                // Сети нет — покажем то, что помним.
            }
        }

        const seen = readStorage(NEWS_SEEN_KEY);

        // Первый заход: запоминаем нынешнее как прочитанное, чтобы точка загорелась
        // на следующей новости, а не на всём, что вышло до знакомства с сайтом.
        if (!seen && latest) {
            writeStorage(NEWS_SEEN_KEY, latest);
            setUnread(false);
            return;
        }

        setUnread(hasUnread(latest, seen));
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh, pathname]);

    useEffect(() => {
        const onSeen = () => setUnread(false);
        window.addEventListener(NEWS_SEEN_EVENT, onSeen);
        return () => window.removeEventListener(NEWS_SEEN_EVENT, onSeen);
    }, []);

    return (
        <Link
            href="/news"
            className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/news`) && `text-red-600`}`}
        >
            Новости
            {unread && (
                <span
                    title="Есть новое"
                    className="inline-block align-super ml-0.5 w-1.5 h-1.5 rounded-full bg-red-600"
                />
            )}
        </Link>
    );
};

export default NewsLink;
