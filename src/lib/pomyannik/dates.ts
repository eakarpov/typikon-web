/** Точная дата, только год (YYYY) или день и месяц без года (--MM-DD). */
export const personalDate = (raw: unknown): string | null => {
    if (typeof raw !== "string") return null;
    if (/^\d{4}$/.test(raw)) return Number(raw) >= 1 ? raw : null;
    const match = /^(\d{4}|-)-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return null;
    const year = match[1] === "-" ? 2000 : Number(match[1]);
    if (year < 1) return null;
    const date = new Date(0);
    date.setUTCFullYear(year, Number(match[2]) - 1, Number(match[3]));
    return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]) ? raw : null;
};
export const fullDate = (raw: unknown): string | null => typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? personalDate(raw) : null;
export const dateParts = (raw: unknown) => {
    const value = personalDate(raw);
    if (!value) return null;
    if (value.length === 4) return { year: Number(value), month: null, day: null };
    const parts = value.match(/^(\d{4}|-)-(\d{2})-(\d{2})$/)!;
    return { year: parts[1] === "-" ? null : Number(parts[1]), month: Number(parts[2]), day: Number(parts[3]) };
};
