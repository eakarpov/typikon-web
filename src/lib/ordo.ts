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
const ask = async <T>(path: string, params?: Record<string, string>): Promise<T | null> => {
    const root = base();
    if (!root) return null;

    const url = new URL(path, root);
    for (const [k, v] of Object.entries(params ?? {})) {
        if (v) url.searchParams.set(k, v);
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
