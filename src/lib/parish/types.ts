// Приходская практика — слой, которого в движке устава нет и быть не должно.
//
// Движок отвечает на вопрос «что полагается»: какие службы стоят на этом дне,
// каким чином и в какую половину суток. Он же нарочно не отвечает на вопрос
// «что и когда служит этот приход»: у него три регистра решений, и все три
// уставные («ЧЕТВЁРТОГО РЕГИСТРА НЕТ НАРОЧНО. Неуставные изменения — местный
// обычай, приходская практика, сокращения „как принято“ — мы пока не
// рассматриваем вовсе», typikon-rules/src/marks.py).
//
// Здесь — как раз четвёртое, и рамка ему такая: это не «настрой устав под
// себя», а ЗАПИСЬ УЖЕ СУЩЕСТВУЮЩЕЙ ПРАКТИКИ. Устав прихода сегодня хранится
// в одном человеке: уходит уставщик — служба меняется, и никто не может
// сказать, как было и почему. Продукт делает эту память наследуемой.

import type { OrdoDay, OrdoStoyanie, OrdoVariant } from "@/lib/ordo";

export type Part = "vecher" | "noch" | "utro" | "den";

export const PART_LABELS: Record<Part, string> = {
    vecher: "вечером",
    noch: "ночью",
    utro: "утром",
    den: "днём",
};

/** Порядок половин суток — тот же, что у движка: день начинается вечером. */
export const PART_ORDER: Record<Part, number> = { vecher: 0, noch: 1, utro: 2, den: 3 };

/**
 * Условие приходского правила. Все заполненные поля соединяются через И;
 * пустое условие значит «всегда».
 *
 * Словарь взят не из головы: каждое поле — то, что движок и так говорит про
 * день. Заводить признак, которого он не отдаёт, значило бы просить настоятеля
 * размечать календарь руками.
 */
export interface ParishCondition {
    /** «2026-04-12» — этот день, или «04-12» — это число всякий год. */
    date?: string;
    /** Дней от Пасхи: −2 это Великий Пяток во всякий год. */
    paschaOffset?: number;
    /** Ключи движка: voskresenie, ponedelnik, … */
    weekday?: string[];
    dayVariant?: ("voskresny" | "subbotny" | "sedmichny")[];
    /** Ключи знаков: bdenie, polieley, strastnaya-pyatok, … */
    sign?: string[];
    feast?: ("prazdnik" | "predprazdnstvo" | "poprazdnstvo" | "otdanie")[];
    /** Двунадесятый праздник — выводится, а не хранится (см. engine.ts). */
    dvunadesyaty?: boolean;
    /** Престольный праздник этого прихода. */
    prestolny?: boolean;
    /** Ключи Триоди: velikiy-post, strastnaya, svetlaya-sedmica, … */
    triod?: string[];
    /** Есть ли среди служб стояния такая: vsenoshchnoe, liturgy… */
    hasService?: string[];
    part?: Part;
}

/** Служба в собрании: либо уставная (ключ движка), либо своя. */
export interface GatheringService {
    key: string;
    label: string;
    /** Своё, чего в уставе нет: молебен, панихида, соборование, венчание. */
    own?: boolean;
}

export interface GatheringSpec {
    part: Part;
    /** «17:00». Пусто — час не назначен, и в расписании это видно как пробел. */
    time?: string;
    /** Сдвиг гражданской даты: −1 для того, что служится накануне. */
    dayOffset?: number;
    services?: string[];
    title?: string;
    /** Минут — для подписного календаря; без него берётся умолчание. */
    duration?: number;
}

export interface ParishOutcome {
    /** Задать состав стояния целиком, отбросив уставный. */
    gatherings?: GatheringSpec[];
    /** Поправить час или название уже сложившегося собрания. */
    set?: { part: Part; time?: string; title?: string; duration?: number };
    /** Ключи служб, которых приход не служит: повечерие, полунощница. */
    drop?: string[];
    /**
     * Вернуть отменённое. Нужно потому, что правила ложатся по возрастанию
     * точности: общее «повечерия не служим» верно круглый год, а Великим
     * постом великое повечерие возвращается — и сказать это должно правило
     * поста, а не оговорка внутри общего.
     */
    keep?: string[];
    /** Добавить своё: молебен по воскресеньям, панихида по субботам. */
    add?: GatheringSpec[];
    /** Какую ветвь уставной развилки берём: ["vsenoshchnoe"] или ["vespers","matins"]. */
    choose?: string[];
    /**
     * ПЕРЕНЕСТИ СЛУЖБУ В ДРУГОЕ СТОЯНИЕ. Самая частая приходская поправка и
     * самая невидимая: устав ставит утреню утром, а русский приход служит её
     * ВЕЧЕРОМ НАКАНУНЕ вместе с вечерней — и в будни, где бдения нет вовсе.
     * Люди работают, и утром до литургии никто не придёт на утреню.
     *
     * Это не «устав говорит иначе», а «мы служим иначе», и потому перенос
     * живёт здесь, а не в движке, и в объяснении назван своим именем.
     */
    move?: { services: string[]; to: Part; dayOffset?: number; note?: string }[];
}

export interface ParishRule {
    key: string;
    label: string;
    when: ParishCondition;
    then: ParishOutcome;
    /** Человеческое «почему у нас так» — идёт в объяснение расписания. */
    note?: string;
    /** Разрешает ничью при равной точности; обычно не нужен. */
    priority?: number;
    source?: string;
}

/**
 * Одно звено объяснения. В этом проекте объяснение обязательно везде: устав
 * отвечает не «так», а «так, потому что», и расписание не вправе отвечать
 * иначе — иначе настоятель не сможет ни проверить его, ни поспорить с ним.
 */
export interface WhyStep {
    kind: "ustav" | "stoyanie" | "rule" | "parish";
    text: string;
    ruleKey?: string;
}

export interface Gathering {
    key: string;
    civil: string;
    part: Part;
    partLabel: string;
    time: string | null;
    title: string;
    /**
     * Чей это день, если не тот, в строке которого собрание стоит. Вечернее
     * богослужение принадлежит уже следующему числу, и без подписи читающий
     * отнесёт его к памяти, напечатанной слева, — к чужой.
     */
    belongsTo: string | null;
    duration: number | null;
    services: GatheringService[];
    why: WhyStep[];
    /** Правка настоятеля легла поверх уставного проекта. */
    edited?: boolean;
    /**
     * Отменено настоятелем. Собрание не выбрасывается, а гасится: в подписном
     * календаре оно уже лежит у прихожан, и его надо ОТМЕНИТЬ, а не спрятать.
     */
    cancelled?: boolean;
}

export interface ParishDay {
    date: string;
    weekdayLabel: string;
    /** Ярлык варианта: «Бдение, воскресный день». */
    label: string;
    sign: string;
    triodLabel: string | null;
    memories: { memoryId: string; label: string }[];
    fastingLabel: string | null;
    /** Непусто, если сегодня престольный праздник — им расписание и красится. */
    prestolny: string | null;
    dvunadesyaty: boolean;
    tone: number | null;
    gatherings: Gathering[];
}

export interface ParishSettings {
    slug: string;
    title: string;
    /** IANA — нужен подписному календарю. */
    timezone: string;
    ustav?: string | null;
    prestoly: { memoryId: string; kind?: string | null; label?: string | null }[];
    rules: ParishRule[];
}

/** Что известно про день к моменту, когда правила спрашивают об условии. */
export interface DayContext {
    day: OrdoDay;
    variant: OrdoVariant;
    stoyanie?: OrdoStoyanie;
    dvunadesyaty: boolean;
    prestolny: boolean;
}
