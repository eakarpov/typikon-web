// Как показывать числа и дни хронологии. Отдельно от вёрстки: этими же
// подписями пользуются и решето, и карточка года, и поправки.
import * as ch from "@/utils/chronology";

const MONTHS_GEN = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export const MONTHS_NOM = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

/** «12 мая 1204» — без года, если он и так назван рядом. */
export const showYmd = ({ year, month, day }: ch.Ymd, withYear = true) =>
    `${day} ${MONTHS_GEN[month - 1]}${withYear ? ` ${year}` : ""}`;

/**
 * День в обоих счётах: юлианским числом (то, что стоит в источнике) и
 * гражданским (то, куда он попадает у нас). Разница стилей от века к веку
 * растёт, и показывать одно без другого значит терять половину ответа.
 */
export const showDay = (jdn: number) => ({
    julian: showYmd(ch.jdnToJulian(jdn)),
    civil: showYmd(ch.jdnToGregorian(jdn)),
    weekday: ch.weekdayOf(jdn),
});

export const showSpan = (span: ch.Span) =>
    `${showYmd(ch.jdnToJulian(span.first))} — ${showYmd(ch.jdnToJulian(span.last))}`;

const COPTIC_ORDINAL = ["первое", "второе", "третье", "четвёртое", "пятое", "шестое"];

/**
 * «9 фаменот 920» — календарём египетского строя. Тринадцатый месяц у них не
 * месяц, а горстка добавочных дней, и число в нём называют порядковым: «третье
 * эпагомены», а не «3 эпагомены».
 */
export const showEgyptianStyle = (months: readonly string[], c: ch.Ymd) =>
    c.month === 13
        ? `${COPTIC_ORDINAL[c.day - 1] ?? c.day} ${months[12]} ${c.year}`
        : `${c.day} ${months[c.month - 1]} ${c.year}`;

export const showCoptic = (c: ch.Ymd) => showEgyptianStyle(ch.COPTIC_MONTHS, c);

export interface CalendarView {
    /** Названия счетов, которые дали ОДИН И ТОТ ЖЕ вид даты. */
    names: string[];
    value: string;
    note?: string;
    /** Счёт объявлен, но ещё не написан: строка стоит пустой и помечена. */
    planned?: boolean;
}

// Счета, которых ещё нет. Стоят в таблице пустыми строками нарочно: читатель,
// не нашедший армянской даты, иначе решит, что мы о ней не знаем, — а мы
// знаем и не сделали. Помета честная: не «синхронизируется» (ничего не
// едет и никуда не подключается), а «в плане» — счёт будет написан.
const PLANNED_CALENDARS: { name: string; note: string }[] = [
    { name: "иудейский", note: "лунно-солнечный; через него определена и сама пасхалия" },
    { name: "хиджра", note: "табличный; истинный, по наблюдению луны, невоспроизводим" },
];

const PLANNED_ERAS: { name: string; note: string }[] = [];

export const PLANNED_MARK = "в плане";

/**
 * Один день во всех видах, какие мы умеем.
 *
 * Совпавшие счета сводятся в одну строку — по той же причине, по какой
 * сводятся чтения эры в переборе: григорианский с новоюлианским дают одну и
 * ту же дату с 1 марта 1600 по 28 февраля 2800, то есть почти всегда, и две
 * одинаковые строки читались бы как два разных ответа. Где они расходятся —
 * строки расходятся сами.
 */
export const calendarViews = (jdn: number): CalendarView[] => {
    const out: CalendarView[] = [];
    const push = (name: string, value: string, note?: string) => {
        const seen = out.find(v => v.value === value && v.note === note);
        if (seen) seen.names.push(name);
        else out.push({ names: [name], value, note });
    };

    push("юлианский", showYmd(ch.jdnToJulian(jdn)));
    push("григорианский", showYmd(ch.jdnToGregorian(jdn)));
    push("новоюлианский", showYmd(ch.jdnToRevisedJulian(jdn)));

    const coptic = ch.jdnToCoptic(jdn);
    out.push(coptic
        ? { names: ["александрийский (коптский)"], value: showCoptic(coptic),
            note: "эры мучеников" }
        : { names: ["александрийский (коптский)"], value: "—",
            note: "день старше эры мучеников (284 год), счёт не начат" });

    const ethiopian = ch.jdnToEthiopian(jdn);
    out.push(ethiopian
        ? { names: ["эфиопский"], value: showEgyptianStyle(ch.ETHIOPIAN_MONTHS, ethiopian),
            note: "эры благодати; тот же день, что 1 тота, но счёт лет свой" }
        : { names: ["эфиопский"], value: "—",
            note: "день старше эры благодати (8 год), счёт не начат" });

    const armenian = ch.jdnToArmenian(jdn);
    out.push(armenian
        ? { names: ["армянский"], value: showEgyptianStyle(ch.ARMENIAN_MONTHS, armenian),
            note: "древний счёт, без високоса: год уходит назад на сутки за четыре года" }
        : { names: ["армянский"], value: "—",
            note: "день старше армянской эры (552 год), счёт не начат" });

    for (const { name, note } of PLANNED_CALENDARS) {
        out.push({ names: [name], value: PLANNED_MARK, note, planned: true });
    }
    return out;
};

const showKoronikonCycle = (jdn: number) => {
    const cycle = ch.koronikonCycle(ch.jdnToJulian(jdn).year);
    return `${cycle.first}\u2013${cycle.last}`;
};

/** Который это круг по счёту от того, с которого короникон ведут (781 год). */
const cycleOrdinal = (jdn: number) => {
    const { first } = ch.koronikonCycle(ch.jdnToJulian(jdn).year);
    return `${Math.floor((first - 781) / ch.KORONIKON_CYCLE) + 13}-й`;
};

export interface EraView {
    name: string;
    value: string;
    note?: string;
    planned?: boolean;
}

/** Лето от Сотворения мира — обоими счетами и всеми стилями начала года. */
export const eraViews = (jdn: number): EraView[] => {
    const alexandrian = ch.alexandrianLeto(jdn);
    return [
        ...ch.ERA_STYLES.map(style => ({
            name: `константинопольское, ${ch.ERA_LABELS[style]} начало`,
            value: String(ch.letoOf(jdn, style)),
        })),
        {
            name: "александрийское (эра Анниана)",
            value: alexandrian === null ? "—" : String(alexandrian),
            note: alexandrian === null
                ? "выражено через коптский год, а он не начат"
                : "год с 1 тота; отстаёт от константинопольского сентябрьского на 16",
        },
        {
            name: "грузинский короникон",
            value: String(ch.koronikonOf(jdn)),
            // Номер сам по себе не датирует: тот же приходится на каждый круг.
            // Назвать круг обязательно, иначе число выглядит датой, а оно её
            // не заменяет.
            note: `${cycleOrdinal(jdn)} круг, ${showKoronikonCycle(jdn)}; `
                + "тот же номер приходится на каждый круг",
        },
        {
            name: "селевкидская (эра Александра)",
            value: String(ch.seleucidOf(jdn)),
            note: "сирийский счёт, год с 1 октября; македонский, весенний, не считаем",
        },
        ...PLANNED_ERAS.map(({ name, note }) => ({
            name, note, value: PLANNED_MARK, planned: true,
        })),
    ];
};
