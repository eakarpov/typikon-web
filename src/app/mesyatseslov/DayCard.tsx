import Link from "next/link";
import { CALENDAR_STYLES, displayedDate, type CalendarMark, type MenologyView, type DateStyle } from "@/lib/menology";
import type { CalendarCard } from "@/lib/menology";
import { signName } from "./signNames";
import styles from "./menology.module.css";

const format = (day: number, month: number, year?: number) =>
    [String(day).padStart(2, "0"), String(month).padStart(2, "0"), year].filter(Boolean).join(".");

export const PHASES: Record<string, string> = {
    prazdnik: "Праздник", predprazdnstvo: "Предпразднство", poprazdnstvo: "Попразднство", otdanie: "Отдание",
};
export const FASTING: Record<CalendarMark["fasting"], string> = {
    fast: "Постный день", free: "Поста нет", mixed: "Разные правила поста", unknown: "Сведений о посте нет",
};

export default function DayCard({ view, churchStyle, card, retry }: {
    view: MenologyView; churchStyle: DateStyle; card: CalendarCard | null; retry: () => void;
}) {
    const civil = displayedDate(view.date, "gregorian");
    const shown = displayedDate(view.date, view.style);
    const church = displayedDate(view.date, churchStyle);
    const service = new URLSearchParams({ date: view.date, ustav: view.ustav });
    if (card?.variant) service.set("variant", card.variant);

    return (
        <article className={styles.card} aria-label="Карточка дня">
            <h2 className="text-xl font-semibold"><time dateTime={view.date}>{format(shown.day, shown.month, shown.year)}</time></h2>
            <p className="text-sm">{card?.weekday}{card?.weekday && " · "}{CALENDAR_STYLES[view.style]} стиль</p>
            <dl className="my-3 grid gap-1 text-sm">
                <div><dt className="inline">Гражданская дата </dt><dd className="inline font-semibold">{format(civil.day, civil.month, civil.year)}</dd></div>
                <div><dt className="inline">Церковная дата </dt><dd className="inline font-semibold">
                    {format(card?.church_date.day ?? church.day, card?.church_date.month ?? church.month)}
                </dd></div>
            </dl>
            {card ? (
                <>
                    {card.feasts.length > 0 && <ul className="mb-3 space-y-1">
                        {card.feasts.map(feast => <li key={`${feast.label}/${feast.phase}`}>
                            <strong>{PHASES[feast.phase] ?? feast.phase}</strong> · {feast.label}
                        </li>)}
                    </ul>}
                    <dl className="space-y-1 text-sm">
                        <div><dt className="inline font-semibold">Знак дня </dt><dd className="inline">{signName(card.sign)}</dd></div>
                        {card.sign_note && <div><dt className="inline font-semibold">Основание </dt><dd className="inline">{card.sign_note}</dd></div>}
                        {card.triod && <div><dt className="inline font-semibold">Триодь </dt><dd className="inline">{card.triod}</dd></div>}
                        <div><dt className="inline font-semibold">Пасхальный круг </dt><dd className="inline">
                            {card.pascha_offset === 0 ? "Пасха" : card.pascha_offset > 0
                                ? `${card.pascha_offset}-й день по Пасхе` : `До Пасхи ${-card.pascha_offset} дн.`}
                        </dd></div>
                        {card.post_week != null && <div><dt className="inline font-semibold">Седмица поста </dt><dd className="inline">{card.post_week}</dd></div>}
                        {card.tone != null && <div><dt className="inline font-semibold">Глас </dt><dd className="inline">{card.tone}</dd></div>}
                        {card.liturgy && <div><dt className="inline font-semibold">Чин службы </dt><dd className="inline">{card.liturgy}</dd></div>}
                    </dl>
                    <div className="my-3">
                        <h3 className="font-semibold">{FASTING[card.fasting]}</h3>
                        {card.fasting_rules.length > 0 && <ul className="mt-1 space-y-2 text-sm">
                            {card.fasting_rules.map((rule, index) => (
                                <li key={`${rule.rule_id}/${rule.who}/${index}`}>
                                    {rule.who === "monah" ? "Для монахов · " : rule.who === "mirianin" ? "Для мирян · " : ""}
                                    {rule.allow_label}{rule.period_label && ` · ${rule.period_label}`}
                                    {rule.disputed && " · Главы расходятся"}
                                    {rule.inherited && " · Общее правило"}
                                    {rule.our_reading && " · Толкование правила"}
                                    {(rule.note || rule.citation) && (
                                        <details><summary className="cursor-pointer">Основание</summary>
                                            {rule.note && <p>{rule.note}</p>}
                                            {rule.citation && <p>{rule.citation}</p>}
                                        </details>
                                    )}
                                </li>
                            ))}
                        </ul>}
                    </div>
                    <h3 className="font-semibold">Святые и памяти</h3>
                    {card.coverage_note && <p className="mt-1 text-sm">{card.coverage_note}</p>}
                    {card.memories.length > 0 ? <ul className="my-2 space-y-2 text-sm">
                        {card.memories.map(memory => (
                            <li key={memory.id}>
                                {memory.href ? <Link className="underline underline-offset-2" href={memory.href}>{memory.label}</Link> : memory.label}
                                <div>{signName(memory.sign)}{memory.appointed && " · В чине дня"}</div>
                            </li>
                        ))}
                    </ul> : <p className="my-2 text-sm">Сведений о памятях дня нет.</p>}
                </>
            ) : (
                <p className="my-4">Карточка дня недоступна. <button type="button" className="underline" onClick={retry}>Повторить</button></p>
            )}
            <nav aria-label="Чтения и службы дня" className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                <Link className="underline underline-offset-2" href={`/calculator/${view.date}`}>Уставные чтения</Link>
                <Link className="underline underline-offset-2" href={`/posledovanie?${service}`}>Последование</Link>
            </nav>
        </article>
    );
}
