import { getPaschaDate } from "@/utils/lectionaryCycle";
import { civilDate } from "@/lib/imeniny/dates";
import type { PomyannikPerson } from "@/lib/pomyannik/types";

// СЧЁТ ПОМИНАЛЬНЫХ ДНЕЙ. Ни базы, ни сессии — только даты, чтобы правила можно
// было проверить сами по себе и не гадать, откуда взялся сороковой день.
//
// ДЕНЬ ПРЕСТАВЛЕНИЯ СЧИТАЕТСЯ ПЕРВЫМ. Оттого третий день — это через два дня
// после кончины, девятый — через восемь, сороковой — через тридцать девять.
// Умерший в понедельник поминается на сороковой день в пятницу через пять
// недель, а не в субботу. Счёт этот повсеместный, но он ОБЫЧАЙ СЧИСЛЕНИЯ, а не
// уставное предписание, и страница обязана сказать об этом словами: ошибка на
// день здесь стоит дорого, а спорить об этом с человеком у нас нет права.
//
// СОРОКОУСТ — НЕ СОРОКОВОЙ ДЕНЬ, и путать их нельзя. Сороковой день считается
// от кончины и наступает один раз. Сорокоуст — сорок литургий подряд, и
// начинается он со дня, когда его заказали: заказанный на девятый день, он и
// кончится на сорок восьмой. Оттого у него своя дата начала, а не вывод из даты
// смерти.

const DAY_MS = 24 * 3600 * 1000;

/** Дата в полдень: часовые сдвиги и переход на летнее время не сдвинут число. */
const at = (iso: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    return Number.isNaN(+d) ? null : d;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const iso = (d: Date): string =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const shift = (date: string, days: number): string | null => {
    const d = at(date);
    return d ? iso(new Date(+d + days * DAY_MS)) : null;
};

/** Сколько суток между датами. Отрицательно, если вторая раньше первой. */
export const between = (from: string, to: string): number | null => {
    const a = at(from), b = at(to);
    if (!a || !b) return null;
    return Math.round((+b - +a) / DAY_MS);
};

export const todayIso = () => iso(new Date());

// --- дни по усопшему -------------------------------------------------------

export interface MemorialDays {
    /** Третий, девятый и сороковой дни. */
    third: string;
    ninth: string;
    fortieth: string;
    /** Идут ли ещё сорок дней — усопший «новопреставленный». */
    newlyDeparted: boolean;
    /** Полных лет со дня преставления на указанную дату. */
    years: number;
}

/**
 * Дни поминовения усопшего.
 *
 * «Новопреставленный» здесь ВЫЧИСЛЯЕТСЯ, а не хранится: помета эта живёт сорок
 * дней и сама собой протухает, а записанная в базу — осталась бы навсегда и
 * пошла бы в записку через десять лет после погребения.
 */
export const memorialDays = (died: string, on: string = todayIso()): MemorialDays | null => {
    const third = shift(died, 2);
    const ninth = shift(died, 8);
    const fortieth = shift(died, 39);
    if (!third || !ninth || !fortieth) return null;

    const passed = between(died, on) ?? 0;
    const d = at(died)!, o = at(on)!;
    let years = o.getFullYear() - d.getFullYear();
    const beforeAnniversary =
        o.getMonth() < d.getMonth() ||
        (o.getMonth() === d.getMonth() && o.getDate() < d.getDate());
    if (beforeAnniversary) years--;

    return { third, ninth, fortieth, newlyDeparted: passed >= 0 && passed < 40,
             years: Math.max(0, years) };
};

export interface SorokoustSpan {
    from: string;
    /** Последний, сороковой день поминовения. */
    to: string;
    /** Сколько дней поминовения прошло, считая сегодняшний. */
    passed: number;
    /** Сколько осталось после сегодняшнего. */
    left: number;
    /**
     * Окончен. В САМЫЙ сороковой день — ещё нет: литургию этого дня служат, и
     * сказать человеку «окончено», пока его имя читают, было бы неправдой.
     */
    done: boolean;
}

/** Сорок дней от заказа. День заказа — первый, как и день преставления. */
export const sorokoustSpan = (from: string, on: string = todayIso()): SorokoustSpan | null => {
    const to = shift(from, 39);
    const gone = between(from, on);
    if (!to || gone === null) return null;
    const passed = Math.min(40, Math.max(0, gone + 1));
    return { from, to, passed, left: Math.max(0, 40 - passed), done: gone > 39 };
};

// --- поминальные дни года --------------------------------------------------

export interface MemorialDay {
    date: string;
    name: string;
    /**
     * Не по Типикону: определение Собора, указ или местный обычай. Такие дни
     * показываются наравне с уставными, но помеченными — выдавать обычай за
     * устав нам нельзя.
     */
    custom: boolean;
    note?: string;
}

/** Ближайшая суббота строго раньше указанной даты. */
const saturdayBefore = (date: string): string | null => {
    const d = at(date);
    if (!d) return null;
    // 6 — суббота. Ровно в субботу отступаем на неделю: день памяти Димитрия
    // Солунского поминальной субботой не становится, поминают накануне него.
    const back = ((d.getDay() - 6 + 7) % 7) || 7;
    return iso(new Date(+d - back * DAY_MS));
};

/**
 * Дни общего поминовения усопших в гражданском году.
 *
 * Подвижные считаются от Пасхи, Димитриевская — от неподвижной памяти Димитрия
 * Солунского (26 октября старого стиля, то есть 8 ноября нового).
 */
export const memorialSaturdays = (year: number): MemorialDay[] => {
    const pascha = getPaschaDate(year);
    const fromPascha = (offset: number) => iso(new Date(+pascha + offset * DAY_MS));

    const out: MemorialDay[] = [
        { date: fromPascha(-57), name: "Суббота мясопустная", custom: false },
        { date: fromPascha(-36), name: "Суббота 2-й седмицы Великого поста", custom: false },
        { date: fromPascha(-29), name: "Суббота 3-й седмицы Великого поста", custom: false },
        { date: fromPascha(-22), name: "Суббота 4-й седмицы Великого поста", custom: false },
        { date: fromPascha(9), name: "Радоница", custom: false },
        { date: fromPascha(48), name: "Суббота Троицкая", custom: false },
    ];

    const dmitry = saturdayBefore(`${year}-11-08`);
    if (dmitry) {
        out.push({
            date: dmitry, name: "Суббота Димитриевская", custom: true,
            note: "суббота перед памятью вмч. Димитрия Солунского; "
                + "в разных митрополиях считается неодинаково",
        });
    }

    out.push(
        { date: `${year}-05-09`, name: "Поминовение усопших воинов", custom: true,
          note: "по определению Архиерейского Собора, а не по Типикону" },
        { date: `${year}-09-11`, name: "Поминовение воинов, за веру и Отечество убиенных",
          custom: true, note: "в день Усекновения главы Иоанна Предтечи, по указу 1769 года" },
    );

    return out.sort((a, b) => a.date.localeCompare(b.date));
};

// --- ближайшее -------------------------------------------------------------

export type EventKind =
    | "nameday" | "birthday" | "anniversary"
    | "third" | "ninth" | "fortieth" | "sorokoust-end" | "memorial-day";

export interface UpcomingEvent {
    date: string;
    kind: EventKind;
    /** Кого касается. Пусто у общих поминальных дней. */
    personId?: string;
    name?: string;
    /** Который год или день — для годовщин. */
    years?: number;
    title: string;
    custom?: boolean;
    note?: string;
}

/** Годовое событие в ближайший его приход начиная с даты. */
const nextYearly = (month: number, day: number, from: string): string | null => {
    const f = at(from);
    if (!f) return null;
    for (const year of [f.getFullYear(), f.getFullYear() + 1]) {
        const candidate = iso(new Date(year, month - 1, day, 12));
        // Февральское тридцатое и подобное Date сдвинет в март — такую дату
        // молча пропускаем, а не показываем не тем числом.
        const back = at(candidate);
        if (!back || back.getMonth() !== month - 1 || back.getDate() !== day) return null;
        if (candidate >= from) return candidate;
    }
    return null;
};

/**
 * Когда именины приходятся в окне.
 *
 * Подвижная память считается от Пасхи КАЖДОГО года окна: одним числом её не
 * записать, и окно длиною в год задевает две Пасхи.
 */
const nameDayDates = (
    nameDay: PomyannikPerson["nameDay"], from: string, until: string,
): string[] => {
    if (!nameDay) return [];
    const first = at(from), last = at(until);
    if (!first || !last) return [];

    if (typeof nameDay.offset === "number") {
        const out: string[] = [];
        for (let year = first.getFullYear(); year <= last.getFullYear(); year++) {
            out.push(iso(new Date(+getPaschaDate(year) + nameDay.offset * DAY_MS)));
        }
        return out;
    }

    if (!nameDay.month || !nameDay.day) return [];

    // Старым стилем — переводим на год, а не храним переведённым: перевод
    // зависит от года, и заранее посчитанное число однажды соврёт.
    if (nameDay.style === "old") {
        const out: string[] = [];
        for (let year = first.getFullYear(); year <= last.getFullYear(); year++) {
            out.push(civilDate({ kind: "fixed", month: nameDay.month, day: nameDay.day }, year));
        }
        return out;
    }

    const date = nextYearly(nameDay.month, nameDay.day, from);
    return date ? [date] : [];
};

const nameOf = (p: PomyannikPerson) => p.churchName || p.name;

/**
 * Что впереди: именины, дни рождения, годовщины, девятый и сороковой дни,
 * конец сорокоуста и общие поминальные дни.
 *
 * Одна лента на всё, потому что читателю она одна и нужна: и раздел
 * «ближайшее», и подписной календарь спрашивают именно её.
 */
export const upcoming = (
    persons: PomyannikPerson[],
    from: string = todayIso(),
    days = 60,
): UpcomingEvent[] => {
    const until = shift(from, days);
    if (!until) return [];
    const within = (date: string | null): date is string =>
        Boolean(date) && date! >= from && date! <= until;

    const out: UpcomingEvent[] = [];

    for (const person of persons) {
        const who = nameOf(person);

        for (const date of nameDayDates(person.nameDay, from, until)) {
            if (!within(date)) continue;
            out.push({ date, kind: "nameday", personId: person.id, name: who,
                       title: `Именины: ${who}` });
        }

        if (person.born && person.kind === "living") {
            const b = at(person.born);
            if (b) {
                const date = nextYearly(b.getMonth() + 1, b.getDate(), from);
                if (within(date)) {
                    out.push({ date, kind: "birthday", personId: person.id, name: who,
                               years: at(date)!.getFullYear() - b.getFullYear(),
                               title: `День рождения: ${who}` });
                }
            }
        }

        if (person.died) {
            const memorial = memorialDays(person.died, from);
            const d = at(person.died);
            if (memorial && d) {
                if (within(memorial.third)) {
                    out.push({ date: memorial.third, kind: "third", personId: person.id,
                               name: who, title: `Третий день: ${who}` });
                }
                if (within(memorial.ninth)) {
                    out.push({ date: memorial.ninth, kind: "ninth", personId: person.id,
                               name: who, title: `Девятый день: ${who}` });
                }
                if (within(memorial.fortieth)) {
                    out.push({ date: memorial.fortieth, kind: "fortieth", personId: person.id,
                               name: who, title: `Сороковой день: ${who}` });
                }
                const date = nextYearly(d.getMonth() + 1, d.getDate(), from);
                // Годовщина в тот же год, что и смерть, — это не годовщина, а
                // сам день кончины: он поминается третьим, девятым и сороковым.
                const years = date ? at(date)!.getFullYear() - d.getFullYear() : 0;
                if (within(date) && years >= 1) {
                    out.push({ date, kind: "anniversary", personId: person.id, name: who,
                               years, title: `Годовщина преставления: ${who}` });
                }
            }
        }

        if (person.sorokoust) {
            const span = sorokoustSpan(person.sorokoust.from, from);
            if (span && within(span.to)) {
                out.push({ date: span.to, kind: "sorokoust-end", personId: person.id,
                           name: who, title: `Оканчивается сорокоуст: ${who}` });
            }
        }
    }

    const years = new Set([at(from)!.getFullYear(), at(until)!.getFullYear()]);
    for (const year of years) {
        for (const day of memorialSaturdays(year)) {
            if (!within(day.date)) continue;
            out.push({ date: day.date, kind: "memorial-day", title: day.name,
                       custom: day.custom, note: day.note });
        }
    }

    // Внутри дня порядок постоянный: иначе одна и та же лента пересобиралась бы
    // по-разному и подписной календарь считал бы это правкой.
    const ORDER: EventKind[] = ["memorial-day", "third", "ninth", "fortieth",
                                "sorokoust-end", "anniversary", "nameday", "birthday"];
    return out.sort((a, b) =>
        a.date.localeCompare(b.date)
        || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)
        || (a.name ?? "").localeCompare(b.name ?? "", "ru"));
};
