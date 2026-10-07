// ПРЕСТОЛЫ: словарь и образы, общие для сервера и для клиента разбора.
//
// Здесь нет ни Mongo, ни прочей серверной тяжести, поэтому этот модуль читает и
// клиентская часть админки (@/app/admin/prestoly/Content). Выборки — в
// @/lib/pilgrimage/prestolReview.

export type PrestolStatus = "pending" | "approved" | "rejected";

/** Откуда престол: имя храма, приходской сайт, Соборы.ру. */
export const SOURCE_LABELS: Record<string, string> = {
    name: "из имени",
    "name-secondary": "из имени (придел)",
    site: "с сайта прихода",
    sobory: "Соборы.ру",
};

/** Источники-находки (обход и свод): у них есть отрывок или ссылка. */
export const FINDING_SOURCES = ["site", "sobory"];

export interface PrestolGroup {
    dedication: string;
    label: string;
    kind?: string;
    source: string;
    /** Сколько престолов этого класса ждёт разбора. */
    n: number;
    /** Сколько среди них главных. */
    main: number;
    /** Разброс уверенности разбора: low — самые шаткие, их и смотреть первыми. */
    low: number;
    high: number;
    /** Образцы словаря, которыми класс найден. */
    patterns: string[];
    /** Один храм-представитель — чтобы понять, о чём класс, не открывая список. */
    sample: string;
    sampleSlug: string;
}

export interface PrestolFinding {
    dedication: string;
    label: string;
    isMain: boolean;
    kind?: string;
    source: string;
    status: PrestolStatus;
    tier?: string;
    pattern?: string;
    confidence?: number;
    evidence?: { url?: string; phrase?: string };
}

export interface TempleFindings {
    slug: string;
    name: string;
    place?: string;
    country?: string;
    findings: PrestolFinding[];
}

export interface GroupPage {
    items: PrestolGroup[];
    total: number;
}
