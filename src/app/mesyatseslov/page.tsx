import Link from "next/link";
import { pageMetadata } from "@/lib/seo/metadata";
import {
    CALENDAR_STYLES, DEFAULT_USTAV, monthContains, monthGrids, selectView, todayInMoscow, ustavStyle,
    type DateStyle,
} from "@/lib/menology";
import { getCalendarUstavy, loadCalendarCard, loadCalendarRange } from "@/lib/menologyData";
import Calendar from "./Calendar";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
    title: "Месяцеслов",
    description: "Годовой уставный календарь, праздники, посты, знаки и памяти святых.",
    path: "/mesyatseslov",
});

export default async function Menology({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
    const first = (key: string) => {
        const value = searchParams[key];
        return Array.isArray(value) ? value[0] : value;
    };
    const ustavy = await getCalendarUstavy().catch(() => null);
    if (!ustavy) return (
        <main className="mx-auto max-w-7xl space-y-4 py-5">
            <h1 className="font-serif text-2xl font-semibold">Месяцеслов</h1>
            <p>Список уставов недоступен. <Link href="/mesyatseslov" className="underline">Повторить</Link></p>
        </main>
    );
    const requestedUstav = first("ustav");
    const option = ustavy.find(u => u.ustav === (requestedUstav || DEFAULT_USTAV))
        ?? ustavy.find(u => u.ustav === DEFAULT_USTAV) ?? ustavy[0];
    const rawStyle = first("style");
    const style = rawStyle && Object.hasOwn(CALENDAR_STYLES, rawStyle) ? rawStyle as DateStyle : "gregorian";
    const rawYear = first("year") ?? "";
    const today = todayInMoscow();
    const churchStyle = ustavStyle(option.style);
    const view = selectView({
        ustav: option.ustav, style, mode: first("mode") === "church" ? "church" : "civil",
        year: /^\d{1,4}$/.test(rawYear) ? Number(rawYear) : undefined, date: first("date"),
    }, today, churchStyle);
    const months = monthGrids(view, churchStyle);
    const selected = months.find(month => monthContains(month, view.date))!;
    const [data, card] = await Promise.all([
        loadCalendarRange(view.ustav, selected.from, selected.to), loadCalendarCard(view.ustav, view.date),
    ]);
    return (
        <main className="mx-auto max-w-7xl space-y-4 py-5">
            <h1 className="font-serif text-2xl font-semibold">Месяцеслов</h1>
            {requestedUstav && requestedUstav !== option.ustav && <p role="status">Запрошенный устав недоступен. Выбран «{option.label}».</p>}
            <Calendar key={JSON.stringify([view.ustav, view.mode, view.style, view.year])} view={view} today={today}
                      churchStyle={churchStyle} ustavy={ustavy} months={months} initial={{ key: selected.key, data }} card={card} />
        </main>
    );
}
