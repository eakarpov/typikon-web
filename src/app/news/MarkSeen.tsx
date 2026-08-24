'use client';
import { useEffect } from "react";
import { NEWS_SEEN_EVENT, NEWS_SEEN_KEY } from "@/lib/news/seen";

// Заход на ленту засчитывается как прочтение: отметка уезжает в localStorage, точка
// «новое» в меню гаснет. Без сервера и без входа на сайт — читателю новостей учётная
// запись ни к чему.

const MarkSeen = ({ latestPublishedAt }: { latestPublishedAt: string | null }) => {
    useEffect(() => {
        const seen = latestPublishedAt ?? new Date().toISOString();

        try {
            localStorage.setItem(NEWS_SEEN_KEY, seen);
        } catch {
            // Приватный режим или запрет хранилища — точка просто останется гореть.
            return;
        }

        // Меню живёт своей жизнью и о переходе не знает — сообщаем событием.
        window.dispatchEvent(new CustomEvent(NEWS_SEEN_EVENT));
    }, [latestPublishedAt]);

    return null;
};

export default MarkSeen;
