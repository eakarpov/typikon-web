// Разбор параметров ручек /api/v2/ordo/*. Пределы жёсткие по той же причине,
// что в params.ts: ручка за ручкой должна нести движку только осмысленное.
// Отличие от списков корпуса — дата обязательна и строга: у устава нет
// «умолчального дня», а вольная трактовка даты («вчера», «завтра») — это
// часовой пояс читателя, который на сервере не решается.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Строгий календарный день. V8 не роняет new Date("2026-02-30") — молча
 * перекатывает на 2 марта, поэтому проверка isNaN одна пропускает несуществующие
 * дни; сверяем день обратно с записью. Уставному движку перекатанная дата
 * нужна не больше, чем клиенту.
 */
const strictDate = (value: string): boolean => {
    if (!DATE.test(value)) return false;
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return false;
    return parsed.getUTCFullYear() === Number(value.slice(0, 4))
        && parsed.getUTCMonth() + 1 === Number(value.slice(5, 7))
        && parsed.getUTCDate() === Number(value.slice(8, 10));
};

/** Одна служба за раз весь суточный круг не вытягивает: предел — с запасом
 *  над числом стояний в самый длинный день года. */
const MAX_SERVICES = 16;

/** Слуги, уставы и варианты — короткие слаги; всё длиннее — не слаг, а мусор. */
const MAX_WORD = 80;

const word = (value: string | null): string | null =>
    value && value.length <= MAX_WORD ? value : null;

export type OrdoParams<T> = { ok: true; value: T } | { ok: false; error: string };

export interface OrdoDayParams {
    date: string;
    /** Незнакомый устав — отказ движка (404), здесь его не перебираем:
     * источник истины о поддерживаемых уставах — сам движок. */
    ustav: string | null;
}

export const parseOrdoDay = (url: URL): OrdoParams<OrdoDayParams> => {
    const date = url.searchParams.get("date");
    if (!date || !strictDate(date)) {
        return { ok: false, error: "Дата указывается в виде ГГГГ-ММ-ДД" };
    }
    return { ok: true, value: { date, ustav: word(url.searchParams.get("ustav")) } };
};

export interface OrdoServicesParams {
    date: string;
    ustav: string | null;
    variant: string | null;
    lang: string | null;
    /** Не названы — все службы дня, кроме вошедших во всенощное. */
    services: string[];
}

export const parseOrdoServices = (url: URL): OrdoParams<OrdoServicesParams> => {
    const date = url.searchParams.get("date");
    if (!date || !strictDate(date)) {
        return { ok: false, error: "Дата указывается в виде ГГГГ-ММ-ДД" };
    }

    const services = url.searchParams.getAll("service").map(word).filter((s): s is string => !!s);
    if (services.length > MAX_SERVICES) {
        return { ok: false, error: `Не больше ${MAX_SERVICES} служб за запрос` };
    }

    return {
        ok: true,
        value: {
            date,
            ustav: word(url.searchParams.get("ustav")),
            variant: word(url.searchParams.get("variant")),
            lang: word(url.searchParams.get("lang")),
            services,
        },
    };
};

/**
 * Пакет одной службы: service обязателен — формат однослужбный (spec/package.md),
 * суточный кругом пакет не собирается. Тела не спрашиваем: публично отдаётся
 * всегда gated-вариант (free), клиенту выбора не даём.
 */
export interface OrdoPackageParams {
    date: string;
    service: string;
    ustav: string | null;
    variant: string | null;
    lang: string | null;
}

export const parseOrdoPackage = (url: URL): OrdoParams<OrdoPackageParams> => {
    const date = url.searchParams.get("date");
    if (!date || !strictDate(date)) {
        return { ok: false, error: "Дата указывается в виде ГГГГ-ММ-ДД" };
    }
    const service = word(url.searchParams.get("service"));
    if (!service) {
        return { ok: false, error: "Пакет собирается на одну службу: назовите её параметром service" };
    }
    return {
        ok: true,
        value: {
            date,
            service,
            ustav: word(url.searchParams.get("ustav")),
            variant: word(url.searchParams.get("variant")),
            lang: word(url.searchParams.get("lang")),
        },
    };
};
