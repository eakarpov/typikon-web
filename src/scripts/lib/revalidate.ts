import { CacheTag } from "@/lib/cache";

// Скрипты правят базу мимо приложения, поэтому кэш выборок про их изменения не знает
// и сайт до часа отдаёт старое. Этот вызов сбрасывает нужные теги.
//
// Нужен REVALIDATE_TOKEN в окружении и в .env.production — без него ручка закрыта,
// и скрипт честно скажет, что кэш сбросить не удалось, вместо тихого молчания.
const BASE_URL = process.env.REVALIDATE_URL || "http://localhost:3000";

export const revalidateTags = async (tags: string[]) => {
    const token = process.env.REVALIDATE_TOKEN;

    if (!token) {
        console.warn(
            `\nКэш НЕ сброшен: не задан REVALIDATE_TOKEN.\n` +
            `Сайт будет отдавать прежние данные до истечения кэша (час).\n` +
            `Либо задайте переменную, либо после накатки почистите .next/cache и пересоберите.`,
        );
        return false;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/revalidate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-revalidate-token": token },
            body: JSON.stringify({ tags }),
        });

        if (!res.ok) {
            console.warn(`Кэш не сброшен: ${BASE_URL}/api/revalidate ответил ${res.status}`);
            return false;
        }

        console.log(`Кэш сброшен по тегам: ${tags.join(", ")}`);
        return true;
    } catch (e) {
        console.warn(`Кэш не сброшен: ${e instanceof Error ? e.message : e}`);
        console.warn(`Если сайт сейчас не запущен — это нормально, кэш соберётся заново при старте.`);
        return false;
    }
};

export const revalidateContent = () => revalidateTags([
    CacheTag.TEXTS, CacheTag.DAYS, CacheTag.WEEKS, CacheTag.MONTHS, CacheTag.BOOKS, CacheTag.SIGNS,
]);

export const revalidateNews = () => revalidateTags([CacheTag.NEWS]);
