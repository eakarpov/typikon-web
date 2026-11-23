"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import {
    CALENDAR_STYLES, MAX_YEAR, MIN_YEAR, civilAt, menologyHref, monthContains, parseCivilDate,
    selectView, ustavStyle, type CalendarRange, type DateStyle, type MenologyMonth, type MenologyView,
} from "@/lib/menology";
import type { CalendarCard, CalendarUstav } from "@/lib/menology";
import DayCard, { FASTING } from "./DayCard";
import { signMark, signName } from "./signNames";
import styles from "./menology.module.css";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const sundayColumn = weekdays.length - 1;
const control = "rounded border border-current bg-transparent px-2 py-1";

function SignMark({ sign }: { sign: string | null }) {
    const { glyph, color } = signMark(sign);
    return <span aria-hidden="true" className={color === "red" ? styles.cinnabar : undefined}>{glyph}</span>;
}

async function fetchMonth(ustav: string, month: MenologyMonth, signal?: AbortSignal): Promise<CalendarRange | null> {
    const params = new URLSearchParams({ ustav, from: month.from, to: month.to });
    try {
        const response = await fetch(`/api/mesyatseslov/range?${params}`, { signal });
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    }
}

export default function Calendar({ view, today, churchStyle, ustavy, months, initial, card }: {
    view: MenologyView; today: string; churchStyle: DateStyle; ustavy: CalendarUstav[];
    months: MenologyMonth[]; initial: { key: string; data: CalendarRange | null }; card: CalendarCard | null;
}) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [ranges, setRanges] = useState<Record<string, CalendarRange | null>>({ [initial.key]: initial.data });
    const [windowMonths] = useState(months);
    const [firstMonth] = useState(initial.key);
    const [focusDate, setFocusDate] = useState(view.date);
    const [retrying, setRetrying] = useState<string[]>([]);
    const scrollAfterSelection = useRef(false);

    useEffect(() => {
        const controller = new AbortController();
        async function loadRemaining() {
            for (const month of windowMonths) {
                if (month.key === firstMonth) continue;
                const result = await fetchMonth(view.ustav, month, controller.signal);
                if (controller.signal.aborted) return;
                setRanges(current => {
                    const previous = current[month.key];
                    return previous && (!result || previous.failed.length <= result.failed.length)
                        ? current : { ...current, [month.key]: result };
                });
            }
        }
        void loadRemaining();
        return () => controller.abort();
    }, [view.ustav, windowMonths, firstMonth]);

    useEffect(() => {
        setRanges(current => {
            const previous = current[initial.key];
            if (initial.data && (!previous || previous.failed.length > initial.data.failed.length)) {
                return { ...current, [initial.key]: initial.data };
            }
            return current;
        });
    }, [initial]);

    const scrollToCard = () => {
        if (window.matchMedia("(max-width: 1279px)").matches) {
            document.getElementById("menology-mobile-card")?.scrollIntoView({ block: "start" });
        }
    };

    useEffect(() => {
        setFocusDate(view.date);
        if (scrollAfterSelection.current) {
            scrollAfterSelection.current = false;
            scrollToCard();
        }
    }, [view.date]);

    const changeSettings = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const ustav = String(form.get("ustav"));
        const mode = form.get("mode") === "church" ? "church" : "civil";
        const style = String(form.get("style")) as DateStyle;
        const year = Number(form.get("year"));
        const styleOfUstav = ustavStyle(ustavy.find(option => option.ustav === ustav)?.style);
        const sameBoundary = mode === view.mode && (mode === "civil" || styleOfUstav === churchStyle);
        const target = selectView({
            ustav, mode, style, date: view.date, year: sameBoundary || year !== view.year ? year : undefined,
        }, today, styleOfUstav);
        start(() => router.push(menologyHref(target), { scroll: false }));
    };

    const retry = async (month: MenologyMonth) => {
        setRetrying(current => [...current, month.key]);
        const result = await fetchMonth(view.ustav, month);
        setRanges(current => result || !current[month.key] ? { ...current, [month.key]: result } : current);
        setRetrying(current => current.filter(key => key !== month.key));
    };

    const arrows = (event: KeyboardEvent<HTMLAnchorElement>, date: string) => {
        const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        const step = steps[event.key];
        if (!step || event.altKey || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        const destination = civilAt(parseCivilDate(date)! + step);
        document.getElementById(`menology-date-${destination}`)?.focus();
    };

    const body = <DayCard view={view} churchStyle={churchStyle} card={card}
                          retry={() => start(() => router.refresh())} />;
    const selectedMonth = months.find(month => monthContains(month, view.date));

    return (
        <>
            <form key={`${view.ustav}/${view.mode}/${view.style}/${view.year}`} method="get" action="/mesyatseslov" onSubmit={changeSettings}
                  className="flex flex-wrap items-end gap-3 text-sm" aria-busy={pending}>
                <input type="hidden" name="date" value={view.date} />
                <label className="grid min-w-0 max-w-full gap-1">Устав
                    <select className={`${control} w-full min-w-0`} name="ustav" defaultValue={view.ustav}>
                        {ustavy.map(option => <option key={option.ustav} value={option.ustav}>{option.label}</option>)}
                    </select>
                </label>
                <label className="grid gap-1">Границы года
                    <select className={control} name="mode" defaultValue={view.mode}>
                        <option value="civil">Гражданский год</option><option value="church">Церковный год</option>
                    </select>
                </label>
                <label className="grid gap-1">Стиль дат
                    <select className={control} name="style" defaultValue={view.style}>
                        {Object.entries(CALENDAR_STYLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                </label>
                <label className="grid gap-1">{view.mode === "church" ? "Год начала" : "Год"}
                    <input required type="number" min={MIN_YEAR} max={MAX_YEAR} className={`${control} w-24`}
                           name="year" defaultValue={view.year} />
                </label>
                <button type="submit" disabled={pending} className={`${control} disabled:opacity-50`}>Показать</button>
                <Link href={menologyHref(selectView({ ...view, year: undefined, date: today }, today, churchStyle))}
                      className="py-1 underline underline-offset-2" prefetch={false}>Сегодня</Link>
            </form>
            <ul aria-label="Обозначения" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <li><span className={styles.feastMark} aria-hidden="true">◆</span> Великий праздник / Пасха</li>
                <li className={`${styles.fastMark} rounded px-1`}>Постный день</li>
                <li className={`${styles.mixedFastMark} rounded px-1`}>Разные правила поста</li>
                <li>⁇ Пост не определён</li>
                <li><SignMark sign="bez-znaka" /> Без знака</li><li>? Знак не определён</li>
                <li><SignMark sign="velikoe-bdenie" /> Великое бдение</li>
                <li><SignMark sign="bdenie" /> Бдение</li>
                <li><SignMark sign="polieley" /> Полиелей</li>
                <li><SignMark sign="slavoslovie" /> Славословие</li><li><SignMark sign="shesterichnaya" /> Шестеричная</li>
                <li><SignMark sign="alliluinaya" /> Аллилуйная</li>
            </ul>
            <p id="menology-keys" className="sr-only">Клавиши со стрелками перемещают фокус между днями. Enter открывает карточку дня.</p>
            <nav aria-label="Месяцы года" className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {months.map(month => <a key={month.key} href={`#menology-month-${month.key}`} className="underline underline-offset-2">
                    {month.label.split(" ")[0]}
                    {months.filter(other => other.label.split(" ")[0] === month.label.split(" ")[0]).length > 1 && ` ${month.label.split(" ")[1]}`}
                </a>)}
            </nav>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {months.map(month => {
                        const range = ranges[month.key];
                        const byDate = new Map(range?.days.map(mark => [mark.date, mark]));
                        const issue = range === null || Boolean(range?.failed.length);
                        const isSelected = selectedMonth?.key === month.key;
                        return (
                            <Fragment key={month.key}>
                                <section id={`menology-month-${month.key}`} className={`${styles.month} scroll-mt-4`} aria-label={month.label}>
                                    <h2 className="mb-1 text-center font-semibold">{month.label}</h2>
                                    <div className="grid grid-cols-7 gap-0.5 text-center">
                                        {weekdays.map(weekday => <span key={weekday} className="text-xs">{weekday}</span>)}
                                        {Array.from({ length: month.leading }, (_, index) => <span key={index} aria-hidden="true" />)}
                                        {month.days.map(({ date, day }, index) => {
                                            const isSunday = (month.leading + index) % weekdays.length === sundayColumn;
                                            const mark = byDate.get(date) ?? (date === card?.date ? card : undefined);
                                            const feast = mark?.feasts.filter(x => x.major).map(x => x.label);
                                            const label = [`${day}, ${month.label}`, ...(feast ?? []), mark && signName(mark.sign),
                                                mark ? FASTING[mark.fasting] : issue ? "Отметки недоступны" : "Отметки загружаются",
                                                date === view.date && "Выбранный день"].filter(Boolean).join(" · ");
                                            return (
                                                <Link key={date} id={`menology-date-${date}`} href={menologyHref({ ...view, date })}
                                                      className={styles.cell} prefetch={false} scroll={false}
                                                      data-selected={date === view.date} data-fasting={mark?.fasting}
                                                      aria-label={label} title={label} aria-current={date === today ? "date" : undefined}
                                                      aria-describedby={focusDate === date ? "menology-keys" : undefined}
                                                      tabIndex={focusDate === date ? 0 : -1}
                                                      onFocus={() => setFocusDate(date)} onKeyDown={event => arrows(event, date)}
                                                      onClick={event => {
                                                          if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
                                                          if (date === view.date) scrollToCard();
                                                          else scrollAfterSelection.current = true;
                                                      }}>
                                                    <span className={isSunday ? `${styles.dayNumber} ${styles.cinnabar}` : styles.dayNumber}>{day}</span>
                                                    <span className={styles.markLine} aria-hidden="true">
                                                        {mark && <SignMark sign={mark.sign} />}
                                                        {mark?.fasting === "unknown" && <sup className={styles.smallMark}>⁇</sup>}
                                                        {feast?.length ? <span className={`${styles.smallMark} ${styles.feastMark}`}> ◆</span> : null}
                                                    </span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                    {range === undefined && <p className="text-xs">Загружаются отметки…</p>}
                                    {issue && <p className="mt-1 text-xs" role="status">
                                        {range?.failed.length ? `Нет отметок для ${range.failed.length} дн.` : "Отметки недоступны."}{" "}
                                        <button type="button" disabled={retrying.includes(month.key)} onClick={() => void retry(month)} className="underline">
                                            {retrying.includes(month.key) ? "Загрузка…" : "Повторить"}
                                        </button>
                                    </p>}
                                </section>
                                {isSelected && <div id="menology-mobile-card" className="scroll-mt-4 sm:col-span-2 lg:col-span-3 xl:hidden">{body}</div>}
                            </Fragment>
                        );
                    })}
                </div>
                <div className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-auto xl:block">{body}</div>
            </div>
        </>
    );
}
