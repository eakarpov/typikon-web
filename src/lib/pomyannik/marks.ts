import type { Rank } from "./types";
export const TEMPORARY_RANKS: Rank[] = ["bolyashchiy", "puteshestvuyushchiy", "zaklyuchennyy", "neprazdnaya"];
export const markToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const expiredRank = (person: { rank?: Rank | null; rankUntil?: string | null }, on = markToday()) =>
    Boolean(person.rank && TEMPORARY_RANKS.includes(person.rank) && person.rankUntil && person.rankUntil < on);
export const effectiveRank = (person: { rank?: Rank | null; rankUntil?: string | null }, on = markToday()): Rank | null =>
    expiredRank(person, on) ? null : person.rank ?? null;
