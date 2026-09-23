// Клиент к службе сборки последования (проект typikon-rules, src/ordo_service.py).
import {reportError} from "@/lib/reportError";
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

/**
 * Служба суток ждёт дольше: холодная сборка всенощного ходит в сеть за
 * зачалами (typikon-rules/src/readings.py, свой тайм-аут 20 с), и оборвать
 * её раньше значит показать «не собралась» там, где она просто небыстрая.
 * Ждёт каждая служба в своём Suspense — остальным это не мешает.
 */
export const ORDO_SUTKI_TIMEOUT_MS = 25000;

export type OrdoDisplay = "loud" | "full" | "quiet" | "cue" | "hidden";

export interface OrdoStep {
    kind: string;
    depth?: number;
    /**
     * Как показать шаг. Пять степеней — из тетрадей ролей (assemble.ROLE_VIEWS):
     * loud — своё крупно, quiet — чужое мельче, cue — зачином.
     */
    display?: OrdoDisplay;
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
    /** Устав, по которому собрано, — применившийся, а не спрошенный. */
    ustav: OrdoUstav | null;
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
    /**
     * Служба этой канвы: vespers, matins, liturgy.
     *
     * Нужна потому, что сборка ПО ДАТЕ слушает службу, а не канву: канву
     * она выбирает сама, по знаку дня. Пока служба сюда не доезжала, выбор
     * канвы с заданной датой не действовал вовсе — какую бы службу ни
     * выбрали, приходила вечерня.
     */
    service?: string | null;
    variant?: string | null;
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
    timeoutMs: number = ORDO_TIMEOUT_MS,
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

    // ОДИН ПОВТОР на обрыв соединения. Служба отвечает по HTTP/1.0 и
    // закрывает сокет после ответа, а клиент, спрашивающий её разом многими
    // запросами (суточный круг — десяток служб), изредка попадает в уже
    // закрытое соединение: «fetch failed», хотя до службы запрос не дошёл
    // вовсе. Тайм-аут не повторяем — служба занята, и второй заход её не
    // разгрузит.
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(timeoutMs),
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
            const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
            if (attempt < 2 && !timedOut) continue;
            reportError(e, { where: "lib/ordo: служба устава недоступна" });
            return null;
        }
    }
};

/** Канвы служб, для которых написано последование. */
export const ordoServices = () => ask<OrdoService[]>("/services").then(list =>
    (list ?? []).map((s: any) => ({
        ordoId: s.ordo_id, label: s.label,
        service: s.service ?? null, variant: s.variant ?? null,
    })));

export interface OrdoQuery {
    ordo?: string;
    /** Устав: «pre-nikonian/old-rite». Не назвали — движок берёт никоновский. */
    ustav?: string;
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
    /** Служба суток: её слушает сборка по дате (см. OrdoService.service). */
    service?: string;
    /**
     * Языки, на которых показать ту же строку: список, `all` или пусто.
     *
     * Состав службы они НЕ меняют — устав решил его до них; это братья по
     * адресу, приложенные к готовым строкам.
     */
    parallel?: string;
}

export const buildOrdo = async (query: OrdoQuery): Promise<OrdoResult | null> => {
    const raw = await ask<any>("/ordo", {
        ordo: query.ordo ?? "",
        ustav: query.ustav ?? "",
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
        service: query.service ?? "",
        parallel: query.parallel ?? "",
    });
    if (!raw || raw.error) return null;

    return {
        ustav: raw.ustav ?? null,
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

/**
 * Устав, по которому служим: «jerusalem/rus-synodal», «pre-nikonian/old-rite».
 *
 * Ось УСТАВА, а не оформления: она решает порядок службы, а не редакцию слов
 * (редакцию заявляет извод самой книги). Слои — знаки, варианты дня,
 * праздничные — принадлежат уставу и адресуются им.
 */
export interface OrdoUstav {
    ustav: string;
    rite: string;
    tradition: string;
    label: string;
    known: boolean;
}

/**
 * Слой устава — знак службы, вариант дня, праздничный слой.
 *
 * КЛЮЧ У СЛОЯ СВОЙ ТОЛЬКО ВНУТРИ УСТАВА: `bez-znaka` есть и у никоновского,
 * и у дониконовского, и это разные слои. Оттого при каждом стоит свой устав,
 * а различать их в списке надо по `layerId` — единственному, что уникально.
 */
export interface OrdoLayer extends OrdoOption {
    layerId: string;
    ustav: string;
}

export interface OrdoNotebook { role: string; label: string }

export interface OrdoOptions {
    ustavy: OrdoUstav[];
    signs: OrdoLayer[];
    dayVariants: OrdoLayer[];
    feasts: OrdoLayer[];
    feastNone: string;
    views: Record<string, string>;
    /** Тетради действующих лиц: `role:<role>` — подача для него. */
    notebooks: OrdoNotebook[];
    languages: OrdoOption[];
    predstoyatel: OrdoOption[];
    prihods: { prihod: string; prestoly: { key: string; label: string; isMain: boolean }[] }[];
}

const layers = (rows: any[]): OrdoLayer[] => (rows ?? []).map((l: any) => ({
    key: l.key, label: l.label, layerId: l.layer_id, ustav: l.ustav,
}));

/**
 * Из чего складывается вопрос к уставу: знаки, варианты дня, слои, приходы.
 *
 * Устав спрашивается ЗДЕСЬ, а не отбирается после: слои принадлежат ему, и
 * кто их адресует, тот и обязан их отбирать. Пока /options отдавала слои всех
 * уставов разом, списки шли с повторяющимися ключами, и дониконовские пункты
 * ставили никоновские значения — выбрать их было нельзя вовсе.
 * Список самих уставов приходит целиком при любом выборе.
 */
export const ordoOptions = async (ustav?: string): Promise<OrdoOptions | null> => {
    const raw = await ask<any>("/options", { ustav: ustav ?? "" });
    if (!raw) return null;
    return {
        ustavy: raw.ustavy ?? [],
        signs: layers(raw.signs),
        dayVariants: layers(raw.day_variants),
        feasts: layers(raw.feasts),
        feastNone: raw.feast_none ?? "net",
        views: raw.views ?? {},
        notebooks: raw.notebooks ?? [],
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

/**
 * ПЕРЕНЕСЁННАЯ ПАМЯТЬ — единственное, чем человек дополняет день сам: памяти
 * дня и варианты называет устав, а перенос решает настоятель. «Главная» —
 * ради самого святого (тогда он первый), иначе — чтобы память не пропала.
 * Различить это может только человек (ordo_service._extra).
 */
export interface OrdoTransfer {
    memoryId: string;
    primary: boolean;
}

/** Строка адреса `ID` или `ID:primary` — так перенос лежит в адресе страницы. */
export const parseTransfer = (raw: string): OrdoTransfer | null => {
    const [memoryId, flag] = raw.split(":");
    return memoryId?.trim() ? { memoryId: memoryId.trim(), primary: flag === "primary" } : null;
};

export const formatTransfer = (t: OrdoTransfer) =>
    t.primary ? `${t.memoryId}:primary` : t.memoryId;

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
    /** Перенесённые памяти, как их поняла служба, — с именами. */
    transfers: (OrdoTransfer & { label: string })[];
}

// порядок значим: первый престол считается главным
const prestolParam = (p: OrdoPrestol): [string, string] =>
    ["prestoly", [p.memoryId, p.kind ?? "", p.label ?? ""].join("|")];

const transferParam = (t: OrdoTransfer): [string, string] =>
    ["add_memory", t.primary ? `${t.memoryId}:primary` : t.memoryId];

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
    opts?: { ustav?: string; prestoly?: OrdoPrestol[]; transfers?: OrdoTransfer[] },
): Promise<OrdoDay | null> => {
    const params: Record<string, string> = { date, ustav: opts?.ustav ?? "" };
    const raw = await ask<any>("/day", params, [
        ...(opts?.prestoly ?? []).map(prestolParam),
        ...(opts?.transfers ?? []).map(transferParam),
    ]);
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
        transfers: (raw.transfers ?? []).map((t: any) => ({
            memoryId: t.memory_id, primary: Boolean(t.primary), label: t.label ?? t.memory_id,
        })),
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
            reportError(e, { where: "lib/ordo: не удалось спросить устав про день", extra: { date: d } });
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


// ─────────────────────────────────────────────────── суточный круг

/**
 * Абзац «Богослужебных указаний» — данными, а не HTML: прозу пишет движок
 * (typikon-rules/src/ukazaniya.py), и грамматика её — «глас тот же», «на 8»
 * — живёт там одна. Вёрстка наша.
 */
export type OrdoUkazRun =
    | { t: string; s?: undefined }
    | { t: string; s: "b" | "plain" | "sub" | "miss" }
    | { t: string; s: "cite"; title: string; href?: string }
    | { s: "rule"; label: string; note: string; t?: undefined };

export type OrdoUkazParagraph =
    | { kind: "head"; text: string }
    | { kind: "p"; plain: boolean; runs: OrdoUkazRun[] };

/**
 * Правила подач — таблицы движка (assemble.ROLE_VIEWS и соседи). Подачу
 * накладывает сайт, но по ЭТИМ таблицам, а не по своей копии.
 * Шаг без роли в `roleViews` зовётся пустой строкой.
 */
export interface OrdoViewRules {
    views: Record<string, string>;
    roleAliases: Record<string, string>;
    roleViews: Record<string, Record<string, OrdoDisplay>>;
    readPositions: string[];
    defaultRole: Record<string, string>;
    notebooks: OrdoNotebook[];
}

export interface OrdoSutkiService {
    key: string;
    label: string;
    /** Ключ стояния: `2026-09-26:vecher`. */
    stoyanie: string;
    civil: string;
    part: OrdoStoyanie["part"];
    partLabel: string;
    replacedBy: string | null;
    placementWhy: string | null;
    /** Не собралась — и почему; остальные поля тогда пусты. */
    error: string | null;
    ordo: string | null;
    feastLabel: string | null;
    layers: string[];
    rules: OrdoRule[];
    /** Шаги БЕЗ подачи — как `ordo.json` пакета .ordo. */
    steps: OrdoStep[];
    ukazaniya: OrdoUkazParagraph[];
}

export interface OrdoSutki {
    ustav: OrdoUstav | null;
    date: string;
    variant: string;
    services: OrdoSutkiService[];
    viewRules: OrdoViewRules;
}

export interface OrdoSutkiQuery {
    date: string;
    ustav?: string;
    variant?: string;
    transfers?: OrdoTransfer[];
    /** Службы по ключу; не названы — все, кроме вошедших во всенощное. */
    services?: string[];
    /** Стояние: ключ или половина суток. */
    part?: string;
    lang?: string;
    parallel?: string;
    psalms?: string;
    bezDiakona?: string;
    predstoyatel?: string;
}

const viewRules = (raw: any): OrdoViewRules => ({
    views: raw?.views ?? {},
    roleAliases: raw?.role_aliases ?? {},
    roleViews: raw?.role_views ?? {},
    readPositions: raw?.read_positions ?? [],
    defaultRole: raw?.default_role ?? {},
    notebooks: raw?.notebooks ?? [],
});

/**
 * Службы суток — все или названные. Сайт спрашивает их ПО ОДНОЙ, чтобы
 * первая пришла, не дожидаясь литургии; день движок считает один раз и
 * держит в кэше, так что лишнего это не стоит.
 */
export const ordoSutki = async (query: OrdoSutkiQuery): Promise<OrdoSutki | null> => {
    const raw = await ask<any>("/sutki", {
        date: query.date,
        ustav: query.ustav ?? "",
        variant: query.variant ?? "",
        part: query.part ?? "",
        lang: query.lang ?? "",
        parallel: query.parallel ?? "",
        psalms: query.psalms ?? "",
        bez_diakona: query.bezDiakona ?? "",
        predstoyatel: query.predstoyatel ?? "",
    }, [
        ...(query.transfers ?? []).map(transferParam),
        ...(query.services ?? []).map(s => ["service", s] as [string, string]),
    ], ORDO_SUTKI_TIMEOUT_MS);
    if (!raw || raw.error) return null;
    return {
        ustav: raw.ustav ?? null,
        date: raw.date,
        variant: raw.variant,
        services: (raw.services ?? []).map((s: any): OrdoSutkiService => ({
            key: s.key,
            label: s.label,
            stoyanie: s.stoyanie,
            civil: s.civil,
            part: s.part,
            partLabel: s.part_label,
            replacedBy: s.replaced_by ?? null,
            placementWhy: s.placement_why ?? null,
            error: s.error ?? null,
            ordo: s.ordo ?? null,
            feastLabel: s.feast_label ?? null,
            layers: s.layers ?? [],
            rules: s.rules ?? [],
            steps: s.steps ?? [],
            ukazaniya: s.ukazaniya ?? [],
        })),
        viewRules: viewRules(raw.view_rules),
    };
};

export interface OrdoMemoryFound {
    memoryId: string;
    label: string;
    book: string;
    month: number | null;
    day: number | null;
    sign: string | null;
}

/** Память для переноса — по имени (движок ищет по заголовку дня). */
export const ordoMemorySearch = async (q: string): Promise<OrdoMemoryFound[] | null> => {
    const raw = await ask<any[]>("/memories", { q, limit: "25" });
    if (!raw) return null;
    return raw.map(m => ({
        memoryId: m.memory_id, label: m.label, book: m.book,
        month: m.month ?? null, day: m.day ?? null, sign: m.sign ?? null,
    }));
};
