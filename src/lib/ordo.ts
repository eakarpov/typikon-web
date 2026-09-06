// Клиент к службе сборки последования (проект typikon-rules, src/ordo_service.py).
//
// Почему служба, а не свой код. Устав — не выборка, а конструктор: какие
// песнопения поются сегодня, сколько их и откуда они берутся, решают правила,
// написанные руками в rules/typikon, и разбирает эти правила полторы тысячи
// строк на Python. Переписать их сюда значило бы завести второй конструктор,
// который разойдётся с первым на первой же правке правила — а правила там
// правятся постоянно, устав ещё достраивается.
//
// Служба слушает только 127.0.0.1 и наружу не смотрит: она читает файлы правил
// по имени из запроса и не знает ни про какие ключи доступа. Ходим к ней
// отсюда, с сервера, и наружу отдаём уже разобранное.

export const ORDO_TIMEOUT_MS = 8000;

export interface OrdoStep {
    kind: string;
    depth?: number;
    display?: "full" | "cue" | "hidden";
    label?: string;
    speaker?: string;
    text?: string;
    cue?: string;
    items?: any[];
    [key: string]: any;
}

export interface OrdoRule {
    kind: string;
    label: string;
    path: string;
    note?: string | null;
}

export interface OrdoResult {
    ordo: string;
    requestedOrdo: string;
    switchedFrom: string | null;
    /** Что назначил бы устав, если бы канву не выбрали руками. */
    typikonWould: string | null;
    feast: string | null;
    feastLabel: string | null;
    memories: { memoryId: string; label: string }[];
    layers: string[];
    rules: OrdoRule[];
    steps: OrdoStep[];
    context: Record<string, any>;
}

export interface OrdoService {
    ordoId: string;
    label: string;
}

const base = () => process.env.ORDO_SERVICE_URL || "";

/**
 * Запрос к службе. Возвращает null, когда её нет: последование — раздел,
 * который может быть не поднят на этом сервере, и это не повод ронять сайт.
 * Отличать «службы нет» от «ничего не нашлось» обязан вызывающий.
 */
const ask = async <T>(
    path: string,
    params?: Record<string, string>,
    // Повторяемые параметры отдельно: престолов у храма бывает несколько, а
    // Record такого не выражает — второй ключ затёр бы первый молча.
    repeated?: [string, string][],
): Promise<T | null> => {
    const root = base();
    if (!root) return null;

    const url = new URL(path, root);
    for (const [k, v] of Object.entries(params ?? {})) {
        if (v) url.searchParams.set(k, v);
    }
    for (const [k, v] of repeated ?? []) {
        if (v) url.searchParams.append(k, v);
    }

    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(ORDO_TIMEOUT_MS),
            // Последование зависит от десятка параметров разом, и кэшировать
            // его по адресу незачем: сборка стоит миллисекунды, а вариантов
            // столько, что кэш всё равно не прогреется.
            cache: "no-store",
        });
        if (!response.ok) {
            console.error(`ordo service ${url.pathname}: ${response.status}`);
            return null;
        }
        return await response.json() as T;
    } catch (e) {
        console.error("ordo service is not reachable:", e);
        return null;
    }
};

/** Канвы служб, для которых написано последование. */
export const ordoServices = () => ask<OrdoService[]>("/services").then(list =>
    (list ?? []).map((s: any) => ({ ordoId: s.ordo_id, label: s.label })));

export interface OrdoQuery {
    ordo?: string;
    month?: string;
    day?: string;
    sign?: string;
    dayVariant?: string;
    feast?: string;
    oktoih?: string;
    predstoyatel?: string;
    lang?: string;
    view?: string;
    psalms?: string;
    bezDiakona?: string;
    date?: string;
    prihod?: string;
    prestol?: string;
}

export const buildOrdo = async (query: OrdoQuery): Promise<OrdoResult | null> => {
    const raw = await ask<any>("/ordo", {
        ordo: query.ordo ?? "",
        month: query.month ?? "",
        day: query.day ?? "",
        sign: query.sign ?? "",
        day_variant: query.dayVariant ?? "",
        feast: query.feast ?? "",
        oktoih: query.oktoih ?? "",
        predstoyatel: query.predstoyatel ?? "",
        lang: query.lang ?? "",
        view: query.view ?? "",
        psalms: query.psalms ?? "",
        bez_diakona: query.bezDiakona ?? "",
        date: query.date ?? "",
        prihod: query.prihod ?? "",
        prestol: query.prestol ?? "",
    });
    if (!raw || raw.error) return null;

    return {
        ordo: raw.ordo,
        requestedOrdo: raw.requested_ordo,
        switchedFrom: raw.switched_from ?? null,
        typikonWould: raw.typikon_would ?? null,
        feast: raw.feast ?? null,
        feastLabel: raw.feast_label ?? null,
        memories: (raw.memories ?? []).map((m: any) => ({ memoryId: m.memory_id, label: m.label })),
        layers: raw.layers ?? [],
        rules: raw.rules ?? [],
        steps: raw.steps ?? [],
        context: raw.context ?? {},
    };
};

export interface OrdoOption { key: string; label: string }

export interface OrdoOptions {
    signs: OrdoOption[];
    dayVariants: OrdoOption[];
    feasts: OrdoOption[];
    feastNone: string;
    views: Record<string, string>;
    languages: OrdoOption[];
    predstoyatel: OrdoOption[];
    prihods: { prihod: string; prestoly: { key: string; label: string; isMain: boolean }[] }[];
}

/** Из чего складывается вопрос к уставу: знаки, варианты дня, слои, приходы. */
export const ordoOptions = async (): Promise<OrdoOptions | null> => {
    const raw = await ask<any>("/options");
    if (!raw) return null;
    return {
        signs: raw.signs ?? [],
        dayVariants: raw.day_variants ?? [],
        feasts: raw.feasts ?? [],
        feastNone: raw.feast_none ?? "net",
        views: raw.views ?? {},
        languages: raw.languages ?? [],
        predstoyatel: raw.predstoyatel ?? [],
        prihods: (raw.prihods ?? []).map((p: any) => ({
            prihod: p.prihod,
            prestoly: (p.prestoly ?? []).map((x: any) => ({
                key: x.key, label: x.label, isMain: x.is_main,
            })),
        })),
    };
};

/** Текст файла правил — для «лестницы», объясняющей выдачу. */
export const ordoRule = (path: string) =>
    ask<{ path: string; text: string }>("/rule", { path });


// ─────────────────────────────────────────────────── день целиком

// Престол прихода передаётся движку ЗНАЧЕНИЕМ: у него своя таблица приходов,
// но она — образец, на котором писалась механика, и хозяин приходов здесь мы.
// Берётся из Temple.prestoly (src/lib/temples.ts), где лежит то же самое.
export interface OrdoPrestol {
    memoryId: string;
    /** gospodskiy | bogorodichen | svyatogo — от вида зависит ряд тропарей по входе. */
    kind?: string | null;
    /** Как приход поминает престол. Пусто — движок возьмёт имя самой памяти. */
    label?: string | null;
}

export interface OrdoDayService {
    key: string;
    label: string;
    ordoId: string;
    /** Слой устава, назвавший канву. */
    namedBy: string | null;
    mark: string;
    markLabel: string;
    /**
     * Ключ службы, которая эту вобрала. Всенощное — не две службы подряд, а
     * одна, и вечерня с утреней в неё вошли; из списка они всё же не убраны,
     * потому что «идеже всенощных не бывает» устав допускает прямо.
     */
    replacedBy: string | null;
    /** Чем поправлено место службы в сутках, если поправлено. */
    placementWhy: string | null;
}

/**
 * СТОЯНИЕ — службы на одной половине гражданских суток, то есть один приход
 * в храм. Половин четыре: vecher, noch, utro, den. Вечерня и всенощное дня
 * стоят НАКАНУНЕ вечером, Преждеосвященная — днём самого дня, пасхальная
 * заутреня — ночью; всё это движок и говорит здесь, вместе с «почему».
 *
 * Час и то, какие из этих служб приход служит, здесь не решается: это
 * приходская практика, и она наша, а не движка.
 */
export interface OrdoStoyanie {
    key: string;
    /** Гражданская дата стояния — она же может не совпадать с датой дня. */
    civil: string;
    part: "vecher" | "noch" | "utro" | "den";
    partLabel: string;
    services: OrdoDayService[];
    why: string[];
}

export interface OrdoMemory {
    memoryId: string;
    label: string;
    book: string | null;
}

/**
 * Правило поста на день — строка `typikon_fasting`, выбранная движком.
 *
 * Правил бывает больше одного, и по двум разным причинам: где книга разводит
 * монаха и мирянина, ответов два (`who`); где расходятся главы — тоже два
 * (`disputed`). Сводить их в один нельзя: это разные разрешения, а не оговорка
 * к одному.
 */
export interface OrdoFastingRule {
    ruleId: number;
    chapter: number;
    /**
     * Человеческое имя правила — и оно БЫВАЕТ ШИРЕ АДРЕСА. «Богоявление в
     * среду или пяток» стояло на правиле, у которого дня седмицы в адресе не
     * было вовсе, и правило срабатывало в понедельник. Строить по ярлыку
     * ответ «почему выбрано» нельзя: только по адресным полям ниже.
     */
    label: string;
    /** Кому сказан ответ: monah | mirianin | null — всем. */
    who: "monah" | "mirianin" | null;
    allow: string;
    allowLabel: string;
    meals: number | null;
    dishes: number | null;
    /** devyatyi-chas | vecher | null */
    until: string | null;

    // Адрес правила: чем именно оно назвало этот день.
    period: string | null;
    periodLabel: string | null;
    postWeek: number | null;
    /** Слово книги: воскресенье здесь `nedelya`, а не `voskresenie`. */
    weekday: string | null;
    triod: string | null;
    feastMonth: number | null;
    feastDay: number | null;
    /** Знак — НИЖНЯЯ ГРАНИЦА, а не равенство (наше чтение, не книжное). */
    sign: string | null;
    prestol: boolean;

    citation: string;
    /**
     * НЕ ПРИЗНАК ЧЕСТНОСТИ. Стоит у всех правил подряд, включая то, что
     * выведено нами: цитата затычки в книге находится — она оттуда и взята,
     * сказана только о другом. «Чьё это правило» спрашивают у `ourReading`.
     */
    citationVerified: boolean;
    /** Оговорка записи. Показывается всегда и дословно. */
    note: string | null;
    /** Наш вывод, а не слова книги. */
    ourReading: boolean;
    /** Общее правило, взятое сословию, о котором книга здесь молчит. */
    inherited: boolean;
    /** Сколько признаков дня правило назвало — этим оно и выбрано. */
    score: number;
    markLabel: string;
    /** Главы книги расходятся об этом дне: правило не одно. */
    disputed: boolean;
}

export interface OrdoVariant {
    key: string;
    label: string;
    sign: string;
    dayVariant: string;
    feast: string | null;
    why: string;
    mark: string;
    markLabel: string;
    citationVerified: boolean;
    /** Одной строкой, как её собирает движок: для подписи в расписании. */
    fastingLabel: string | null;
    /** Те же правила разобранными — для страницы, которая объясняет, а не подписывает. */
    fasting: OrdoFastingRule[];
    /** Храмовая глава — непусто, если сегодня престольный праздник прихода. */
    hram: Record<string, any> | null;
    services: OrdoDayService[];
    stoyaniya: OrdoStoyanie[];
}

export interface OrdoDay {
    date: string;
    churchDate: { month: number; day: number };
    weekday: string;
    weekdayLabel: string;
    dayVariant: string;
    pascha: string;
    paschaOffset: number;
    tone: number | null;
    triod: string | null;
    triodLabel: string | null;
    postWeek: number | null;
    memories: OrdoMemory[];
    variants: OrdoVariant[];
}

const service = (raw: any): OrdoDayService => ({
    key: raw.key,
    label: raw.label,
    ordoId: raw.ordo_id,
    namedBy: raw.named_by ?? null,
    mark: raw.mark,
    markLabel: raw.mark_label,
    replacedBy: raw.replaced_by ?? null,
    placementWhy: raw.placement_why ?? null,
});

const fastingRule = (raw: any): OrdoFastingRule => ({
    ruleId: raw.rule_id,
    chapter: raw.chapter,
    label: raw.label,
    who: raw.who || null,
    allow: raw.allow,
    allowLabel: raw.allow_label ?? raw.allow,
    meals: raw.meals ?? null,
    dishes: raw.dishes ?? null,
    until: raw.until || null,
    period: raw.period || null,
    periodLabel: raw.period_label ?? null,
    postWeek: raw.post_week ?? null,
    weekday: raw.weekday || null,
    triod: raw.triod || null,
    feastMonth: raw.feast_month ?? null,
    feastDay: raw.feast_day ?? null,
    sign: raw.sign || null,
    prestol: Boolean(raw.prestol),
    citation: raw.citation ?? "",
    citationVerified: Boolean(raw.citation_verified),
    note: raw.note || null,
    ourReading: Boolean(raw.our_reading),
    inherited: Boolean(raw.inherited),
    score: raw.score ?? 0,
    markLabel: raw.mark_label ?? "",
    disputed: Boolean(raw.disputed),
});

const variant = (raw: any): OrdoVariant => ({
    key: raw.key,
    label: raw.label,
    sign: raw.sign,
    dayVariant: raw.day_variant,
    feast: raw.feast ?? null,
    why: raw.why ?? "",
    mark: raw.mark,
    markLabel: raw.mark_label,
    citationVerified: raw.citation_verified !== false,
    fastingLabel: raw.fasting_label ?? null,
    // `?? []` не для красоты: сайт и движок выкатываются порознь, и «служба
    // отвечает прежней сборкой» — рабочее состояние, а не поломка
    fasting: (raw.fasting ?? []).map(fastingRule),
    hram: raw.hram ?? null,
    services: (raw.services ?? []).map(service),
    stoyaniya: (raw.stoyaniya ?? []).map((s: any) => ({
        key: s.key,
        civil: s.civil,
        part: s.part,
        partLabel: s.part_label,
        services: (s.services ?? []).map(service),
        why: s.why ?? [],
    })),
});

/**
 * Что за день и что положено служить. Возвращает null, когда служба не
 * поднята или дату не поняла, — отличать одно от другого обязан вызывающий.
 */
export const ordoDay = async (
    date: string,
    opts?: { ustav?: string; prestoly?: OrdoPrestol[] },
): Promise<OrdoDay | null> => {
    const params: Record<string, string> = { date, ustav: opts?.ustav ?? "" };
    const raw = await ask<any>("/day", params, (opts?.prestoly ?? []).map(p =>
        // порядок значим: первый престол считается главным
        ["prestoly", [p.memoryId, p.kind ?? "", p.label ?? ""].join("|")]));
    if (!raw || raw.error || !raw.day) return null;

    const d = raw.day;
    return {
        date: d.date,
        churchDate: d.church_date,
        weekday: d.weekday,
        weekdayLabel: d.weekday_label,
        dayVariant: d.day_variant,
        pascha: d.pascha,
        paschaOffset: d.pascha_offset,
        tone: d.tone ?? null,
        triod: d.triod ?? null,
        triodLabel: d.triod_label ?? null,
        postWeek: d.post_week ?? null,
        memories: (d.memories ?? []).map((m: any) => ({
            memoryId: m.memory_id, label: m.label, book: m.book ?? null,
        })),
        variants: (d.variants ?? []).map(variant),
    };
};

// —— Месяц дат разом ————————————————————————————————————————————————
//
// Живёт здесь, а не у прихода, откуда переехало: месячная сетка нужна и
// расписанию прихода, и трапезе, и тянуть приходский модуль в общий раздел
// ради восьми строк было бы неправильно.

/** Сколько дат спрашиваем разом. Столько же, сколько в /calendar.ics: движок
 *  отвечает за миллисекунды, но занимать им весь пул соединений незачем. */
const CONCURRENCY = 8;

export interface OrdoRangeResult {
    days: Map<string, OrdoDay>;
    /** Даты, на которые движок не ответил. */
    failed: string[];
}

export const ordoRange = async (
    dates: string[],
    opts?: { ustav?: string | null; prestoly?: OrdoPrestol[] },
): Promise<OrdoRangeResult> => {
    const days = new Map<string, OrdoDay>();
    const ask = async (d: string) => {
        try {
            return await ordoDay(d, { ustav: opts?.ustav ?? undefined, prestoly: opts?.prestoly });
        } catch (e) {
            console.error(`ordo: не удалось спросить устав про ${d}`, e);
            return null;
        }
    };

    for (let i = 0; i < dates.length; i += CONCURRENCY) {
        const chunk = dates.slice(i, i + CONCURRENCY);
        const got = await Promise.all(chunk.map(async d => [d, await ask(d)] as const));
        for (const [d, day] of got) if (day) days.set(d, day);
    }

    // ВТОРОЙ ЗАХОД — ПО ОДНОМУ. Первый сбой почти всегда не «движок не знает
    // этого дня», а «мы спросили восьмерых разом и не дождались»: клиент рвёт
    // соединение по таймауту, и в логе службы остаётся broken pipe. Повтор
    // поодиночке стоит миллисекунды и снимает почти все такие потери; то, что
    // не ответило и во второй раз, — уже настоящий сбой, и о нём говорится.
    const failed: string[] = [];
    for (const d of dates.filter(x => !days.has(x))) {
        const day = await ask(d);
        if (day) days.set(d, day); else failed.push(d);
    }
    return { days, failed };
};

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * Даты месяца — и ещё один день сверх него.
 *
 * Лишний день не про запас: вечернее стояние первого числа СЛЕДУЮЩЕГО месяца
 * ложится на вечер последнего числа этого. Не спросив его, расписание
 * оборвалось бы на пустом вечере — том самом, в который приход придёт.
 */
export const monthDates = (year: number, month: number): string[] => {
    const out: string[] = [];
    const d = new Date(Date.UTC(year, month - 1, 1));
    while (d.getUTCMonth() === month - 1) {
        out.push(isoDate(d));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    out.push(isoDate(d));
    return out;
};
