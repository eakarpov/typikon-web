import { MONTH_OF } from "@/utils/chantLabels";
import { RANK_BY_KEY, type PomyannikPerson, type Rank, type Sex } from "@/lib/pomyannik/types";
import type { EventKind } from "@/lib/pomyannik/reckoning";

// Подписи помянника. Отдельно от правил счёта: те проверяются тестом и меняться
// не должны от того, что на странице переписали слово.

/** «12 марта 2019». Год опускается, когда он и так понятен из соседства. */
export const humanDate = (iso: string | null | undefined, withYear = true): string => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
    if (!m) return "";
    const day = Number(m[3]), month = Number(m[2]);
    return `${day} ${MONTH_OF[month]}${withYear ? ` ${m[1]}` : ""}`;
};

// Именительный падеж: день стоит в перечне сам по себе — «11 сентября,
// пятница», — а не после предлога.
const WEEKDAY = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

export const weekdayOf = (iso: string): string => {
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(+d) ? "" : WEEKDAY[d.getDay()];
};

/** Чин в том роде, какой у лица. Женская форма есть не у всякого чина. */
export const rankLabel = (rank: Rank | null | undefined, sex: Sex): string => {
    if (!rank) return "";
    const info = RANK_BY_KEY[rank];
    if (!info) return "";
    return sex === "f" && info.feminine ? info.feminine.label : info.label;
};

/** Он же в родительном падеже — так чин и читается в записке. */
export const rankGenitive = (rank: Rank | null | undefined, sex: Sex): string => {
    if (!rank) return "";
    const info = RANK_BY_KEY[rank];
    if (!info) return "";
    return sex === "f" && info.feminine ? info.feminine.genitive : info.genitive;
};

export const EVENT_LABEL: Record<EventKind, string> = {
    "nameday": "именины",
    "birthday": "день рождения",
    "anniversary": "годовщина преставления",
    "third": "третий день",
    "ninth": "девятый день",
    "fortieth": "сороковой день",
    "sorokoust-end": "оканчивается сорокоуст",
    "memorial-day": "поминовение усопших",
};

/** «через 3 дня», «сегодня», «завтра» — так до дня понятнее, чем числом. */
export const inDays = (days: number): string => {
    if (days <= 0) return "сегодня";
    if (days === 1) return "завтра";
    if (days === 2) return "послезавтра";
    const last = days % 10, teen = days % 100;
    const word = teen >= 11 && teen <= 14 ? "дней" : last === 1 ? "день" : last >= 2 && last <= 4 ? "дня" : "дней";
    return `через ${days} ${word}`;
};

/** Как лицо зовётся на странице: церковное имя вперёд, гражданское в скобках. */
export const displayName = (person: Pick<PomyannikPerson, "name" | "churchName">): string =>
    person.churchName && person.churchName !== person.name
        ? `${person.churchName} (${person.name})`
        : person.name;

export const YEARS = (n: number): string => {
    const last = n % 10, teen = n % 100;
    if (teen >= 11 && teen <= 14) return `${n} лет`;
    if (last === 1) return `${n} год`;
    if (last >= 2 && last <= 4) return `${n} года`;
    return `${n} лет`;
};

/**
 * Помета церковнославянским письмом — для записки.
 *
 * `null` значит, что книжного написания этой пометы мы не знаем (см. RankInfo.cs),
 * и вызывающий обязан на это посмотреть, а не подставить гражданку молча.
 */
export const rankChurchGenitive = (rank: Rank | null | undefined, sex: Sex): string | null => {
    if (!rank) return null;
    const info = RANK_BY_KEY[rank];
    if (!info) return null;
    return sex === "f" && info.feminine ? info.feminine.cs : info.cs;
};
