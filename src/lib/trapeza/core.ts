import { MONTH_OF, SIGN_LABELS } from "@/utils/chantLabels";
import type { OrdoDay, OrdoFastingRule, OrdoVariant } from "@/lib/ordo";

// Трапеза по Типикону: разбор ответа движка в подачу.
//
// Здесь только чистое — ни движка, ни базы: страница объясняет, а объяснение
// должно быть проверяемо тестом, а не глазами на живом дне. Выборка и кэш
// живут в store.ts, по тому же разделению, что в @/lib/otzvuki.
//
// ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА: ярлык правила не источник. Книга говорит
// «аще случится… в среду, или пяток», и ярлык это повторяет, — а адрес у
// правила бывает шире сказанного (мы такие нашли и починили в корпусе, но
// ручаться за будущие записи нельзя). Поэтому «почему выбрано» строится
// ТОЛЬКО из адресных полей, и никогда из ярлыка.

/** Слова книги о днях седмицы: воскресенье она зовёт неделей. */
const WEEKDAY_LABELS: Record<string, string> = {
    ponedelnik: "понедельник",
    vtornik: "вторник",
    sreda: "среда",
    chetverg: "четверг",
    pyatnitsa: "пятница",
    subbota: "суббота",
    nedelya: "неделя (воскресенье)",
};

const UNTIL_LABELS: Record<string, string> = {
    "devyatyi-chas": "по 9-м часе",
    vecher: "до вечера",
};

/**
 * Лестница строгости, от строгой к слабой.
 *
 * Объявлена и в движке (`fasting.py`, STRICTNESS), но в выдачу не попадает и
 * там ничем не пользуется. Повторяем её здесь, потому что перечень разрешений
 * закрыт ограничением схемы (CHECK на `allow`) — разойтись двум спискам
 * негде, а сравнивать строгость надо на вебе: ею красится месячная сетка.
 */
export const STRICTNESS = [
    "ne-yadim", "suhoyadenie", "varenie", "vino", "elei", "ryba", "syr",
    "myaso", "vse",
] as const;

export const strictness = (allow: string): number => {
    const at = STRICTNESS.indexOf(allow as typeof STRICTNESS[number]);
    // Незнакомое разрешение ставим в середину, а не в край: и «строжайшее»,
    // и «свободнейшее» были бы утверждением, которого мы не знаем.
    return at === -1 ? Math.floor(STRICTNESS.length / 2) : at;
};

/** Девять ступеней в четыре краски: больше глаз на сетке не различает. */
export const shadeOf = (allow: string): 0 | 1 | 2 | 3 => {
    const at = strictness(allow);
    if (at <= 0) return 0;
    if (at <= 2) return 1;
    if (at <= 5) return 2;
    return 3;
};

/**
 * Вердикт словами: «сухоядение, единожды днём, два блюда, до вечера».
 *
 * Период сюда не входит — он свойство дня, а не правила, и на странице стоит
 * своей строкой; в движке `describe` склеивает их вместе, потому что ему надо
 * уместиться в одну подпись.
 */
export const verdictOf = (rule: OrdoFastingRule): string => {
    const parts = [rule.allowLabel];
    if (rule.meals === 1) parts.push("единожды днём");
    else if (rule.meals === 2) parts.push("дважды днём");
    if (rule.dishes === 2) parts.push("два блюда");
    else if (rule.dishes === 3) parts.push("три блюда");
    const until = rule.until ? UNTIL_LABELS[rule.until] : null;
    if (until) parts.push(until);
    return parts.join(", ");
};

/** Кому сказан ответ. Пусто — правило общее, и адресата у строки нет. */
export const estateLabel = (who: string | null): string | null =>
    who === "monah" ? "монахам" : who === "mirianin" ? "мирянам" : null;

export interface WhyPart {
    key: string;
    text: string;
}

/**
 * Чем правило назвало этот день — по адресным полям, не по ярлыку.
 *
 * Пустой список значит, что правило не назвало ничего: это затычка «на все
 * прочие дни», и говорить о ней надо иначе (см. isOurInference).
 */
export const whyOf = (rule: OrdoFastingRule): WhyPart[] => {
    const out: WhyPart[] = [];
    if (rule.periodLabel) out.push({ key: "period", text: `пост: ${rule.periodLabel}` });
    else if (rule.period) out.push({ key: "period", text: `пост: ${rule.period}` });
    if (rule.postWeek) out.push({ key: "postWeek", text: `седмица поста: ${rule.postWeek}-я` });
    if (rule.weekday) {
        out.push({
            key: "weekday",
            text: `день седмицы: ${WEEKDAY_LABELS[rule.weekday] ?? rule.weekday}`,
        });
    }
    if (rule.triod) out.push({ key: "triod", text: `место в Триоди: ${rule.triod}` });
    if (rule.feastMonth && rule.feastDay) {
        out.push({
            key: "feast",
            text: `число месяцеслова: ${rule.feastDay} ${MONTH_OF[rule.feastMonth]} (церк.)`,
        });
    }
    if (rule.sign) {
        // ЗНАК — НИЖНЯЯ ГРАНИЦА, и сказать об этом надо здесь же: иначе
        // читатель не поймёт, почему правило о славословии решило день бдения.
        out.push({
            key: "sign",
            text: `знак службы не ниже: ${SIGN_LABELS[rule.sign] ?? rule.sign}`,
        });
    }
    if (rule.prestol) out.push({ key: "prestol", text: "престольный праздник храма" });
    return out;
};

/**
 * Правило выведено нами, а не сказано книгой.
 *
 * Спрашиваем движок (`ourReading`), но проверяем и строением: правило, не
 * назвавшее ни одного признака дня, — затычка «на все прочие дни» по самому
 * своему устройству, а затычка не может быть словами книги. Две проверки не
 * дублируют друг друга: флаг ставится руками и может быть забыт у новой
 * записи, а строение не забудешь.
 *
 * `citationVerified` тут ни при чём, и опираться на него нельзя: цитата
 * затычки в книге находится — она оттуда и взята, сказана только о другом.
 */
export const isOurInference = (rule: OrdoFastingRule): boolean =>
    rule.ourReading || whyOf(rule).length === 0;

export interface Estates {
    /** Правила, сказанные монахам. */
    monah: OrdoFastingRule[];
    /** Правила, сказанные мирянам. */
    mirianin: OrdoFastingRule[];
    /** Правила, сказанные всем разом. */
    common: OrdoFastingRule[];
}

/**
 * Разбор ответа по сословиям.
 *
 * Подставлять правило одного сословия другому запрещено: это разные
 * разрешения, а не оговорка к одному. Где книга сказала только монахам, у
 * мирян остаётся либо общее правило с пометой `inherited`, либо пусто — и
 * пустоту страница обязана назвать словами, а не молча закрыть монашеской
 * мерой.
 */
export const estatesOf = (rules: OrdoFastingRule[]): Estates => ({
    monah: rules.filter(r => r.who === "monah"),
    mirianin: rules.filter(r => r.who === "mirianin"),
    common: rules.filter(r => !r.who),
});

/**
 * Спор глав: правила одного сословия, разошедшиеся по разрешению.
 *
 * Движок уже схлопнул те случаи, где главы говорят об одном и разнятся
 * мелочью, — значит всякий пришедший спор настоящий. Порядок — по номеру
 * главы: по строгости он читался бы как выбор победителя.
 */
export const disputedGroups = (rules: OrdoFastingRule[]): OrdoFastingRule[][] => {
    const byEstate = new Map<string, OrdoFastingRule[]>();
    for (const rule of rules) {
        const key = rule.who ?? "";
        byEstate.set(key, [...(byEstate.get(key) ?? []), rule]);
    }
    return [...byEstate.values()]
        .filter(group => group.length > 1)
        .map(group => [...group].sort((a, b) => a.chapter - b.chapter));
};

/** Применён ли порог знака: правило сказано о меньшем знаке, чем сегодняшний. */
export const signIsThreshold = (
    rule: OrdoFastingRule, actualSign: string | null | undefined,
): boolean => !!rule.sign && !!actualSign && rule.sign !== actualSign;

/** Вариант, который назначает устав, — тот же, что берёт приходское расписание. */
export const chosenVariant = (day: OrdoDay | null): OrdoVariant | null =>
    day?.variants?.[0] ?? null;

/**
 * Варианты, у которых трапеза вышла другой.
 *
 * Сличаем по готовой подписи движка — ровно по той строке, которую читатель и
 * увидел бы. Расходятся варианты нечасто (в Петров пост, где знак решает), и
 * молчать об этом нельзя: ответ дан для одной службы из нескольких возможных.
 */
export const variantDisagreement = (day: OrdoDay | null): OrdoVariant[] => {
    const chosen = chosenVariant(day);
    if (!chosen || !day) return [];
    return day.variants.filter(v => v.key !== chosen.key
        && (v.fastingLabel ?? "") !== (chosen.fastingLabel ?? ""));
};

export type ShortKind = "verdict" | "disputed" | "silent";

export interface ShortAnswer {
    kind: ShortKind;
    line: string | null;
}

/**
 * Одна строка для страницы дня — и молчание там, где строки мало.
 *
 * Молчим в двух случаях. Спор глав в строку не сжать: «главы расходятся» без
 * разбора пугает, а разбор в строку не влезет. И затычку «поста нет» не
 * повторяем: это наш вывод, а не слова книги, и утверждать его полтораста раз
 * в год в месте, где оговорке нет места, значило бы говорить его чаще всего,
 * что книга действительно сказала.
 */
export const shortAnswer = (rules: OrdoFastingRule[]): ShortAnswer => {
    if (!rules.length) return { kind: "silent", line: null };
    if (rules.some(r => r.disputed)) {
        return { kind: "disputed", line: "главы Типикона на этот день расходятся" };
    }
    if (rules.every(isOurInference)) return { kind: "silent", line: null };

    const parts = rules.map(rule => {
        const estate = estateLabel(rule.who);
        const verdict = verdictOf(rule) + (rule.inherited ? " (по общему правилу)" : "");
        return estate ? `${estate}: ${verdict}` : verdict;
    });
    const head = rules[0].periodLabel;
    const body = parts.join("; ");
    return { kind: "verdict", line: head ? `${head} — ${body}` : body };
};

/**
 * Сегодняшняя ГРАЖДАНСКАЯ дата в часовом поясе храма.
 *
 * Не `getTodayDate()` из @/utils/dates: та вычитает тринадцать суток, отдавая
 * старый стиль для монговского календаря, — а движок ждёт гражданскую и
 * церковную считает сам. Ошибиться здесь значит показать трапезу позапрошлой
 * седмицы, и никто этого не заметит.
 */
export const todayCivil = (timeZone = "Europe/Moscow", now = new Date()): string =>
    new Intl.DateTimeFormat("sv-SE", { timeZone }).format(now);

export type Segment =
    | { kind: "day"; date: string }
    | { kind: "month"; year: number; month: number };

/** Нижняя граница — год исправления календаря; выше — предел здравого смысла. */
const YEAR_MIN = 1583;
const YEAR_MAX = 2200;

/**
 * Разбор адреса: «2026-09-04» — день, «2026-09» — месяц.
 *
 * Год зажат нарочно. Дат бесконечно много, и без границы всякий обходчик
 * водил бы движок по календарю до скончания века, а кэш страниц рос бы по
 * пустому пространству.
 */
export const parseSegment = (raw: string | null | undefined): Segment | null => {
    if (!raw) return null;
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (day) {
        const [, y, m, d] = day;
        const year = Number(y), month = Number(m), date = Number(d);
        if (year < YEAR_MIN || year > YEAR_MAX) return null;
        if (month < 1 || month > 12 || date < 1 || date > 31) return null;
        // Сентябрь 31-е разбирается регуляркой, но такого дня нет: сверяем
        // с настоящим календарём, иначе движок получит несуществующую дату.
        const parsed = new Date(Date.UTC(year, month - 1, date));
        if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) return null;
        return { kind: "day", date: raw };
    }
    const month = /^(\d{4})-(\d{2})$/.exec(raw);
    if (month) {
        const year = Number(month[1]), mon = Number(month[2]);
        if (year < YEAR_MIN || year > YEAR_MAX) return null;
        if (mon < 1 || mon > 12) return null;
        return { kind: "month", year, month: mon };
    }
    return null;
};

/** Соседний день — для переходов «вчера / завтра». */
export const shiftDay = (date: string, days: number): string => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};
