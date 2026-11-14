import { RANK_BY_KEY, type Rank } from "./types";
export const TEMPORARY_RANKS: Rank[] = ["bolyashchiy", "tyazhkobolyashchiy", "uchashchiysya", "prisnopamyatnyy", "ubiennyy", "puteshestvuyushchiy", "zaklyuchennyy", "neprazdnaya", "novoprestavlennyy"];
export const markToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
type Marked = {
    rank?: Rank | null;
    mark?: Rank | null;
    rankUntil?: string | null;
    kind?: string;
    died?: string | null;
};
export const statusRank = (p: Marked): Rank | null => p.rank && !TEMPORARY_RANKS.includes(p.rank) ? p.rank : null;
export const temporaryRank = (p: Marked): Rank | null => p.mark !== undefined ? p.mark : p.rank && TEMPORARY_RANKS.includes(p.rank) ? p.rank : null;
export const expiredRank = (p: Marked, on = markToday()) => Boolean(temporaryRank(p) && p.rankUntil && p.rankUntil < on);
export const effectiveMark = (p: Marked, on = markToday()): Rank | null => {
    // Сороковой день включительно; только полная дата позволяет считать срок.
    if (p.kind === "departed" && /^\d{4}-\d{2}-\d{2}$/.test(p.died ?? "")) {
        const days = (Date.parse(on) - Date.parse(p.died!)) / 86400000;
        if (days >= 0 && days < 40)
            return "novoprestavlennyy";
    }
    const mark = temporaryRank(p);
    if(mark === "novoprestavlennyy" && p.kind === "departed" && /^\d{4}-\d{2}-\d{2}$/.test(p.died ?? "")) return null;
    const allowed = mark && (!p.kind || !RANK_BY_KEY[mark]?.only || RANK_BY_KEY[mark].only === p.kind);
    if (allowed)
        return expiredRank(p, on) ? null : mark;
    return null;
};
/** Совместимость с потребителями одного поля. Новым нужен effectiveRanks. */
export const effectiveRank = (p: Marked, on = markToday()): Rank | null => statusRank(p) ?? effectiveMark(p, on);
export const effectiveRanks = (p: Marked, on = markToday()): Rank[] => [statusRank(p), effectiveMark(p, on)].filter((r): r is Rank => !!r);
