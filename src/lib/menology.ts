import {
    gregorianToJdn, jdnToGregorian, jdnToJulian, jdnToRevisedJulian, julianToJdn,
    revisedJulianToJdn, type Ymd,
} from "@/utils/chronology";
import { weekFromPascha, weekFromPentecost } from "@/utils/movableCycle";

import type { OrdoUstav } from "./ordo";

export const DEFAULT_USTAV = "jerusalem/rus-synodal";
export const CALENDAR_STYLES = {
    gregorian: "Григорианский",
    julian: "Юлианский",
    revised: "Новоюлианский",
} as const;
export type DateStyle = keyof typeof CALENDAR_STYLES;
export type YearMode = "civil" | "church";
export const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

export interface MenologyView {
    ustav: string;
    mode: YearMode;
    style: DateStyle;
    year: number;
    date: string;
}

export interface MenologyMonth {
    key: string;
    label: string;
    from: string;
    to: string;
    leading: number;
    days: { date: string; day: number }[];
}

export interface FeastMark { label: string; phase: string; major: boolean }
export interface CalendarMark {
    date: string;
    sign: string | null;
    fasting: "fast" | "free" | "mixed" | "unknown";
    feasts: FeastMark[];
}

export interface CalendarDetail extends CalendarMark {
    church_date: { month: number; day: number };
    weekday: string;
    pascha_offset: number;
    triod: string | null;
    post_week: number | null;
    tone: number | null;
    liturgy: string | null;
    sign_note: string | null;
    coverage_note: string | null;
    variant: string | null;
    fasting_rules: {
        rule_id: number;
        who: "monah" | "mirianin" | null;
        allow_label: string;
        period_label: string | null;
        citation: string;
        note: string | null;
        disputed: boolean;
        our_reading: boolean;
        inherited: boolean;
    }[];
    memories: { id: string; label: string; sign: string | null; appointed: boolean }[];
}

export interface CalendarRange {
    days: CalendarMark[];
    failed: string[];
}

export function paschalCycleLabel(offset: number): string {
    if (offset < 0) return `До Пасхи ${-offset} дн.`;
    if (offset === 0) return "Пасха";
    const week = offset < 7 ? "Светлая седмица" :
        offset <= 49 ? `${weekFromPascha(offset)}-я седмица по Пасхе` :
            `${weekFromPentecost(offset)}-я седмица по Пятидесятнице`;
    return `${week} · ${offset}-й день по Пасхе`;
}

const toJdn = { gregorian: gregorianToJdn, julian: julianToJdn, revised: revisedJulianToJdn };
const fromJdn = { gregorian: jdnToGregorian, julian: jdnToJulian, revised: jdnToRevisedJulian };
const pad = (n: number) => String(n).padStart(2, "0");
export const civilDate = ({ year, month, day }: Ymd) => `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
export const civilAt = (jdn: number) => civilDate(jdnToGregorian(jdn));
export const MIN_YEAR = 2;
export const MAX_YEAR = 9997;

export function parseCivilDate(iso?: string): number | null {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [year, month, day] = iso.split("-").map(Number);
    if (year < MIN_YEAR || year > MAX_YEAR + 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const jdn = gregorianToJdn({ year, month, day });
    return civilAt(jdn) === iso ? jdn : null;
}

export const todayInMoscow = () => new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short", timeZone: "Europe/Moscow",
}).format(new Date());

export const ustavStyle = (style?: string): DateStyle => style === "new-julian" ? "revised" : "julian";
export const displayedDate = (date: string, style: DateStyle) => fromJdn[style](parseCivilDate(date)!);

export function yearOf(jdn: number, mode: YearMode, churchStyle: DateStyle): number {
    if (mode === "civil") return jdnToGregorian(jdn).year;
    const date = fromJdn[churchStyle](jdn);
    return date.month < 9 ? date.year - 1 : date.year;
}

function yearSpan(year: number, mode: YearMode, churchStyle: DateStyle) {
    const style = mode === "civil" ? "gregorian" : churchStyle;
    const month = mode === "civil" ? 1 : 9;
    return { first: toJdn[style]({ year, month, day: 1 }), next: toJdn[style]({ year: year + 1, month, day: 1 }) };
}

export function selectView(
    input: { ustav: string; mode: YearMode; style: DateStyle; year?: number; date?: string },
    today: string,
    churchStyle: DateStyle,
): MenologyView {
    const day = parseCivilDate(input.date) ?? parseCivilDate(today)!;
    const requested = input.year ?? yearOf(day, input.mode, churchStyle);
    const year = Math.max(MIN_YEAR, Math.min(MAX_YEAR, requested));
    const { first, next } = yearSpan(year, input.mode, churchStyle);
    return { ...input, year, date: civilAt(day >= first && day < next ? day : first) };
}

export function monthGrids(view: MenologyView, churchStyle: DateStyle): MenologyMonth[] {
    const { first, next } = yearSpan(view.year, view.mode, churchStyle);
    const groups: MenologyMonth[] = [];
    for (let jdn = first; jdn < next; jdn++) {
        const { year, month, day } = fromJdn[view.style](jdn);
        const date = civilAt(jdn);
        const key = `${year}-${pad(month)}`;
        let group = groups.at(-1);
        if (group?.key !== key) {
            group = { key, label: `${MONTHS[month - 1]} ${year}`, from: date, to: date, leading: jdn % 7, days: [] };
            groups.push(group);
        }
        group.days.push({ date, day });
        group.to = date;
    }
    return groups;
}

export const monthContains = (month: MenologyMonth, date: string) => month.from <= date && date <= month.to;

export function menologyHref(view: MenologyView) {
    return "/mesyatseslov?" + new URLSearchParams({
        ustav: view.ustav, mode: view.mode, style: view.style, year: String(view.year), date: view.date,
    });
}

export type CalendarUstav = OrdoUstav & { style: string };

export interface CalendarCard extends CalendarDetail {
    memories: (CalendarDetail["memories"][number] & { href?: string })[];
}
