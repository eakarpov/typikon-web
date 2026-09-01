import Link from "next/link";
import { viewer } from "@/lib/rights-server";
import type { Capability } from "@/lib/rights";

// ОГЛАВЛЕНИЕ ПО ВОЗМОЖНОСТЯМ, А НЕ ПО ЗВАНИЮ.
//
// Страница была закрыта правом «править содержимое», и модератор приходов не
// видел её вовсе — то есть роль у него была, а входа в неё не было: адрес
// разбора заявок он мог узнать только от нас.
//
// Теперь открыта всякому, у кого есть хоть одна возможность, и показывает
// ровно то, что ему можно. Не имеющий ни одной по-прежнему не видит ничего.

interface Section { cap: Capability; title: string; links: [string, string][] }

const SECTIONS: Section[] = [
    {
        cap: "parish.claims",
        title: "Приходы",
        links: [["/admin/parish-claims", "Заявки на ведение расписания"]],
    },
    {
        cap: "content",
        title: "Редактирование по коллекциям",
        links: [
            ["/admin/books", "Редактирование книг"],
            ["/admin/bible", "Издания Библии"],
            ["/admin/weeks", "Редактирование недель"],
            ["/admin/months", "Редактирование месяцев"],
            ["/admin/signs", "Редактирование знаков Типикона"],
        ],
    },
    {
        cap: "content",
        title: "Редактирование по id",
        links: [
            ["/admin/texts", "Редактирование текстов"],
            ["/admin/days", "Редактирование дней"],
            ["/admin/places", "Редактирование мест"],
            ["/admin/pericopes", "Зачала"],
        ],
    },
    {
        cap: "content",
        title: "SQLITE БД",
        links: [
            ["/admin/nobles", "База по князьям (sqlite)"],
            ["/admin/nobles/families", "База по князьям — рода"],
            ["/admin/nobles/states", "База по князьям — державности"],
            ["/admin/nobles/nationalities", "База по князьям — национальности"],
            ["/admin/nobles/import", "База по князьям — импорт из Wikidata"],
        ],
    },
    {
        cap: "content",
        title: "Разбор и публикации",
        links: [
            ["/admin/corrections", "Исправление ошибок"],
            ["/admin/texting", "Предложения по отекстовке"],
            ["/admin/channel-posts", "Посты в Telegram/VK"],
            ["/admin/mentions", "Упоминания святых в чтениях"],
            ["/admin/news", "Новости"],
            ["/admin/api-tokens", "Ключи API"],
        ],
    },
    {
        cap: "roles.grant",
        title: "Права",
        links: [["/admin/roles", "Кому что можно"]],
    },
];

const Admin = async () => {
    if (!process.env.SHOW_ADMIN) return null;

    const { userId, caps } = await viewer();
    const dev = process.env.NODE_ENV === "development";
    const mine = SECTIONS.filter(s => dev || caps.has(s.cap));

    if (!dev && !userId) return <div className="p-4">Войдите</div>;
    if (!mine.length) return <div className="p-4">Нет доступа</div>;

    return (
        <div className="flex flex-row flex-wrap gap-8 p-4">
            {mine.map(s => (
                <div className="flex flex-col" key={s.title}>
                    <p><strong>{s.title}</strong></p>
                    {s.links.map(([href, label]) => (
                        <Link href={href} key={href}>{label}</Link>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default Admin;
