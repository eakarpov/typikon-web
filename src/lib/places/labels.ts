// Подписи для показа мест: род, состояние, достоверность, роль и язык имени, годы.
import type { Confidence, NameRole, PlaceKind, PlaceStatus, RelationType } from "@/lib/places/schema";

export const KIND_LABELS: Record<PlaceKind, string> = {
    settlement: "поселение",
    region: "область",
    mountain: "гора",
    river: "река",
    sea: "море",
    lake: "водоём",
    valley: "долина",
    spring: "источник",
    desert: "пустыня",
    island: "остров",
    monastery: "монастырь",
    building: "сооружение",
    route: "путь",
    other: "место",
};

export const STATUS_LABELS: Record<PlaceStatus, string> = {
    extant: "существует",
    ruins: "руины",
    lost: "утрачено",
    uncertain: "местоположение не установлено",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
    certain: "несомненно",
    probable: "вероятно",
    disputed: "спорно",
};

export const ROLE_LABELS: Record<NameRole, string> = {
    biblical: "В Писании",
    historical: "Исторические",
    slavonic: "Славянские",
    modern: "Современные",
    variant: "Другие написания",
};

/** Направленная связь глазами текущего места: исходящая и входящая. */
export const RELATION_LABELS: Record<RelationType, { out: string; in: string }> = {
    succeeds: { out: "Предшественник", in: "Преемник" },
    part_of: { out: "Входит в", in: "Включает" },
    located_in: { out: "В пределах", in: "В его пределах" },
    identified_with: { out: "Отождествляется с", in: "Здесь отождествляют" },
    near: { out: "Рядом с", in: "Рядом" },
};

const LANGS: Record<string, string> = {
    ru: "рус.", csl: "слав.", en: "англ.", grc: "греч.", el: "новогреч.", la: "лат.", heb: "евр.", he: "евр.",
    hbo: "древнеевр.", arb: "араб.", ar: "араб.", akk: "аккад.", egy: "егип.", cop: "копт.", syc: "сир.",
    ota: "осман.", tr: "тур.", fa: "перс.", hy: "арм.", und: "",
};

export const langLabel = (code: string) => LANGS[code] ?? code;

/** Год для показа: «330 до Р. Х.», «640». */
export const yearLabel = (year: number) => (year < 0 ? `${-year} до Р. Х.` : String(year));

/** Промежуток лет: «330 до Р. Х. — 640», «с 1930», «до 1930». */
export const spanLabel = (from?: number, to?: number) => {
    if (from !== undefined && to !== undefined) return `${yearLabel(from)} — ${yearLabel(to)}`;
    if (from !== undefined) return `с ${yearLabel(from)}`;
    if (to !== undefined) return `до ${yearLabel(to)}`;
    return "";
};
