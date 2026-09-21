import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/authorize/sessions";
import { myFont } from "@/utils/font";
import { getTodayDate } from "@/utils/dates";
import { todayCivil } from "@/lib/trapeza/core";
import { knownTimeZone } from "@/lib/push/zones";
import { between } from "@/lib/pomyannik/reckoning";
import { AHEAD_DAYS, personalToday } from "@/lib/personal/today";
import { paragraphAnchor } from "@/lib/personal/progress";
import { EVENT_LABEL, humanDate, inDays, weekdayOf, YEARS } from "@/app/pomyannik/labels";
import ContentToday from "@/app/ContentToday";
import TrapezaToday from "@/app/components/TrapezaToday";
import MyTempleToday from "@/app/components/MyTempleToday";
import TimeZoneCookie from "@/app/segodnya/TimeZoneCookie";

// СЕГОДНЯ — для меня.
//
// Сайт устроен по разделам: чтения дня, помянник, именины, храм, заметки. Человеку
// же нужен не раздел, а день: что сегодня читается, кого сегодня поминать, где я
// остановился вчера. Всё это у нас было — порознь и каждое за своим входом.
// Страница ничего не считает сама: она ставит рядом то, что уже посчитано.
//
// ЗАКРЫТА ЦЕЛИКОМ, как помянник: на ней имена из помянника и заметки.

export const metadata: Metadata = {
    title: "Сегодня — Уставные чтения",
    description: "Чтения дня, место, где вы остановились, поминальные дни и памяти святых с вашим именем.",
    robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DEFAULT_ZONE = "Europe/Moscow";

const Section = ({ title, aside, children }: {
    title: string; aside?: React.ReactNode; children: React.ReactNode;
}) => (
    <section className="flex flex-col gap-2">
        <h2 className="font-bold font-serif text-sm flex flex-wrap gap-x-2 items-baseline">
            {title}
            {aside && <span className="font-normal text-slate-400">{aside}</span>}
        </h2>
        {children}
    </section>
);

const more = "text-red-900 hover:underline";

const SegodnyaPage = async () => {
    const jar = await cookies();
    const session = await decrypt(jar.get("session")?.value);
    const userId = session?.userId as string | undefined;

    if (!userId) {
        return (
            <div className={`${myFont.variable} pt-2 flex flex-col gap-4 max-w-2xl`}>
                <h1 className="font-bold font-serif">Сегодня</h1>
                <p className="font-serif text-slate-800">
                    Здесь собирается ваш день: чтения, место, где вы остановились, поминальные дни
                    вашего помянника и памяти святых с вашим именем. Страница видна только вам.{" "}
                    <Link href="/login" className={more}>Войдите</Link>, чтобы её открыть.
                </p>
            </div>
        );
    }

    const rawZone = decodeURIComponent(jar.get("tz")?.value ?? "");
    const zone = rawZone && knownTimeZone(rawZone) ? rawZone : DEFAULT_ZONE;
    const date = todayCivil(zone);
    const data = await personalToday(userId, date);

    const todayEvents = data.events.filter(e => e.date === date);
    const laterEvents = data.events.filter(e => e.date !== date);

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-6`}>
            <TimeZoneCookie assumed={zone} />

            <div className="max-w-2xl">
                <h1 className="font-bold font-serif">
                    Сегодня{data.userName ? `, ${data.userName}` : ""}
                </h1>
                <p className="font-serif text-slate-600 text-sm mt-1">
                    {humanDate(date)}, {weekdayOf(date)}
                </p>
                <div className="mt-2 flex flex-col gap-1">
                    <TrapezaToday date={date} />
                    <MyTempleToday date={date} />
                </div>
            </div>

            {data.progress.length > 0 && (
                <Section title="Продолжить чтение">
                    <ul className="flex flex-col gap-2">
                        {data.progress.map(row => (
                            <li key={row.textId} className="font-serif text-sm flex flex-col gap-1 max-w-2xl">
                                <span className="flex flex-wrap gap-x-2 items-baseline">
                                    {row.href ? (
                                        <Link href={`${row.href}#${paragraphAnchor(row.paragraph)}`} className={more}>
                                            {row.textName ?? "Без названия"}
                                        </Link>
                                    ) : (
                                        <span className="text-slate-500">текст убран из собрания</span>
                                    )}
                                    <span className="text-slate-400 text-xs">
                                        абзац {row.paragraph + 1} из {row.total} · {row.percent}%
                                    </span>
                                </span>
                                <span className="h-1 bg-slate-200 rounded" aria-hidden>
                                    <span className="block h-1 bg-red-900 rounded" style={{ width: `${row.percent}%` }} />
                                </span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {(todayEvents.length > 0 || data.nameDays.some(n => n.date === date)) && (
                <Section title="Сегодня помянуть">
                    <ul className="flex flex-col gap-1 font-serif text-sm">
                        {todayEvents.map((event, i) => (
                            <li key={`t-${event.kind}-${event.personId ?? i}`} className="text-slate-800">
                                {event.personId && event.name ? (
                                    <>
                                        <Link href={`/pomyannik/${event.personId}`} className={more}>{event.name}</Link>
                                        {" — "}{EVENT_LABEL[event.kind]}
                                        {event.kind === "anniversary" && event.years ? `, ${YEARS(event.years)}` : ""}
                                    </>
                                ) : event.title}
                                {event.custom && (
                                    <span className="text-amber-700 text-xs" title={event.note}> · день не уставный</span>
                                )}
                            </li>
                        ))}
                        {data.nameDays.filter(n => n.date === date).map(n => (
                            <li key={`n-${n.saint.slug}`} className="text-slate-800">
                                память святого с вашим именем:{" "}
                                <Link href={`/saints/${n.saint.slug}`} className={more}>{n.saint.name}</Link>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            <Section title="Чтения дня">
                <ContentToday today={getTodayDate(`${date}T12:00:00`)} />
                <Link href={`/calculator/${date}`} className={`font-serif text-sm ${more}`}>
                    день целиком →
                </Link>
            </Section>

            <Section title="Ближайшее" aside={`· ${AHEAD_DAYS} дней`}>
                {laterEvents.length === 0 && data.nameDays.every(n => n.date === date) ? (
                    <p className="font-serif text-sm text-slate-600">
                        {data.personsCount === 0 ? (
                            <>Помянник пуст. <Link href="/pomyannik" className={more}>Впишите имена</Link> —
                                девятый и сороковой день, годовщины и именины будут считаться сами.</>
                        ) : "В ближайшие две недели памятных дней нет."}
                    </p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {[
                            ...laterEvents.map((event, i) => ({ date: event.date, key: `e-${i}`, node: (
                                <span className="text-slate-800">
                                    {event.personId && event.name ? (
                                        <>
                                            <Link href={`/pomyannik/${event.personId}`} className={more}>{event.name}</Link>
                                            {" — "}{EVENT_LABEL[event.kind]}
                                            {event.kind === "anniversary" && event.years ? `, ${YEARS(event.years)}` : ""}
                                        </>
                                    ) : event.title}
                                </span>
                            ) })),
                            ...data.nameDays.filter(n => n.date !== date).map(n => ({
                                date: n.date, key: `n-${n.date}-${n.saint.slug}`, node: (
                                    <span className="text-slate-800">
                                        святой с вашим именем:{" "}
                                        <Link href={`/saints/${n.saint.slug}`} className={more}>{n.saint.name}</Link>
                                        {n.saint.confidence === "guess" && (
                                            <span className="text-amber-700 text-xs"> · имя определено догадкой</span>
                                        )}
                                    </span>
                                ),
                            })),
                        ].sort((a, b) => a.date.localeCompare(b.date)).map(row => (
                            <li key={row.key} className="font-serif text-sm flex flex-wrap gap-x-2 items-baseline">
                                <span className="text-slate-500 w-32 shrink-0">
                                    {humanDate(row.date, false)}, {weekdayOf(row.date)}
                                </span>
                                {row.node}
                                <span className="text-slate-400 text-xs">{inDays(between(date, row.date) ?? 0)}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {!data.userName && (
                    <p className="font-serif text-sm text-slate-600">
                        Укажите имя в <Link href="/profile" className={more}>профиле</Link> — здесь
                        появятся памяти святых, носивших его.
                    </p>
                )}
                {data.nameUnknown && (
                    <p className="font-serif text-sm text-slate-600">
                        Имени «{data.userName}» в указателе имён святцев нет. Указатель выведен нами и
                        неполон; церковная форма имени может быть иной —{" "}
                        <Link href="/imeniny" className={more}>посмотрите в именинах</Link>.
                    </p>
                )}
            </Section>

            {data.unreadZapiski !== null && data.unreadZapiski > 0 && (
                <Section title="Записки">
                    <p className="font-serif text-sm text-slate-800">
                        Непрочитанных записок: {data.unreadZapiski}.{" "}
                        <Link href="/pomyannik/prinyatye" className={more}>открыть →</Link>
                    </p>
                </Section>
            )}

            {data.temples.length > 0 && (
                <Section title="Ваши храмы">
                    <ul className="flex flex-col gap-1 font-serif text-sm">
                        {data.temples.map(t => (
                            <li key={t.slug}>
                                <Link href={`/parish/${t.slug}/schedule/${date.slice(0, 7)}`} className={more}>
                                    расписание на месяц — {t.slug}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {data.favourites.length > 0 && (
                <Section title="Избранное" aside={`· ${data.favouritesCount}`}>
                    <ul className="flex flex-col gap-1 font-serif text-sm">
                        {data.favourites.map(f => (
                            <li key={f.textId}>
                                {f.textName ? (
                                    <Link href={`/reading/${f.textId}`} className={more}>{f.textName}</Link>
                                ) : <span className="text-slate-500">текст убран из собрания</span>}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {data.notes.length > 0 && (
                <Section title="Последние заметки" aside={`· ${data.notesCount}`}>
                    <ul className="flex flex-col gap-2 font-serif text-sm max-w-2xl">
                        {data.notes.map(n => (
                            <li key={n.id} className="flex flex-col">
                                <Link href={`/reading/${n.textId}`} className={more}>
                                    {n.textName ?? "текст"}
                                </Link>
                                <span className="text-slate-700">
                                    {n.note.length > 200 ? `${n.note.slice(0, 200)}…` : n.note}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <Link href="/profile#notes" className={`font-serif text-sm ${more}`}>все заметки →</Link>
                </Section>
            )}

            <section className="max-w-2xl border-t pt-3">
                <h2 className="font-serif font-bold text-sm">Что здесь хранится</h2>
                <p className="font-serif text-sm text-slate-600 mt-1">
                    Место чтения запоминается по абзацу и только у вошедшего: одна отметка на текст,
                    прежняя перезаписывается, истории чтения сайт не ведёт. Памяти святых с вашим
                    именем — не «ваши именины»: дня рождения учётная запись не знает, и какую из
                    памятей считать своей, решаете вы. Даты считаются по вашему часовому поясу.
                </p>
            </section>
        </div>
    );
};

export default SegodnyaPage;
