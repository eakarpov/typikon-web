import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/authorize/sessions";
import { myFont } from "@/utils/font";
import { getFeed } from "@/lib/pomyannik/service";
import { memorialSaturdays, todayIso } from "@/lib/pomyannik/reckoning";
import { humanDate, weekdayOf } from "@/app/pomyannik/labels";
import Feed from "@/app/pomyannik/kalendar/Feed";

// ПОМИНАЛЬНЫЕ ДНИ ГОДА И ПОДПИСКА.
//
// Дни эти общие — они не зависят от того, чьи имена в помяннике, — и потому
// стоят отдельной страницей, а не в самом помяннике: спрашивают их не «кого
// поминать», а «когда идти».

export const metadata: Metadata = {
    title: "Поминальные дни — Помянник",
    robots: { index: false, follow: false },
};

const KalendarPage = async () => {
    const cookie = (await cookies()).get("session")?.value;
    const session = await decrypt(cookie);
    if (!session?.userId) {
        return (
            <div className={`${myFont.variable} pt-2 max-w-2xl`}>
                <p className="font-serif">
                    <Link href="/login" className="text-red-900 hover:underline">Войдите</Link>,
                    чтобы вести помянник.
                </p>
            </div>
        );
    }

    const today = todayIso();
    const year = Number(today.slice(0, 4));
    const feed = await getFeed(session.userId as string);
    const days = [...memorialSaturdays(year), ...memorialSaturdays(year + 1)]
        .filter(day => day.date >= today)
        .slice(0, 12);

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-6`}>
            <div className="max-w-2xl">
                <h1 className="font-bold font-serif">Поминальные дни</h1>
                <p className="font-serif text-slate-800 mt-2">
                    Дни общего поминовения усопших — те, в какие поминают всех, а не своих по
                    именам. Подвижные считаются от Пасхи и в разные годы приходятся на разные
                    числа.
                </p>
            </div>

            <section>
                <ul className="flex flex-col gap-1">
                    {days.map(day => (
                        <li key={`${day.date}-${day.name}`}
                            className="font-serif text-sm flex flex-wrap gap-x-2 items-baseline">
                            <span className="text-slate-500 w-40 shrink-0">
                                {humanDate(day.date)}, {weekdayOf(day.date)}
                            </span>
                            <span className="text-slate-800">{day.name}</span>
                            {day.custom && (
                                <span className="text-amber-700 text-xs">· не уставный</span>
                            )}
                        </li>
                    ))}
                </ul>
                {/* Обычай от устава здесь надо развести словами, а не одной
                    пометой в строке: разница существенная */}
                <p className="font-serif text-sm text-slate-600 mt-3 max-w-2xl">
                    <strong>Помеченные не уставные.</strong> Мясопустная, субботы Великого
                    поста и Троицкая указаны Типиконом. Радоница — повсеместный обычай.
                    Димитриевская суббота считается от памяти вмч. Димитрия Солунского и в
                    разных митрополиях выпадает неодинаково. Девятое мая — определение
                    Архиерейского Собора, одиннадцатое сентября — указ 1769 года. Ни то ни
                    другое не Типикон, и выдавать их за него мы не станем.
                </p>
            </section>

            <section className="flex flex-col gap-3 border-t pt-4">
                <h2 className="font-bold font-serif text-sm">Подписка на календарь</h2>
                <Feed initial={feed ? {
                    token: feed.token, withNames: feed.withNames,
                    lastUsedAt: feed.lastUsedAt ? new Date(feed.lastUsedAt).toISOString() : null,
                } : null} />
            </section>

            <p className="font-serif text-sm">
                <Link href="/pomyannik" className="text-red-900 hover:underline">← помянник</Link>
            </p>
        </div>
    );
};

export default KalendarPage;
