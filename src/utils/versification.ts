// Традиции нумерации стихов — и чья нумерация чем является.
//
// ЗАЧЕМ ЭТО ОТДЕЛЬНО НАЗВАНО. «Мф. 1:1–25» — не свойство книги, а АДРЕС В
// ЧЬЁМ-ТО СЧЁТЕ. Пока счёт в проекте один, это незаметно; но зачала у нас —
// зачала Типикона Русской Церкви, и записаны они славянским счётом, тогда как
// греческое издание печатает те же стихи под другими номерами (Притч. 30:1
// славянских — это Притч. 24:24 греческих). Стоит появиться второму уставу со
// своей разбивкой, и молчаливое допущение «номер значит одно и то же везде»
// начнёт тихо портить чтения — ровно так, как оно уже портило их между
// изданиями, пока не завели canonRef.
//
// Поэтому основа названа явно и здесь, а не подразумевается.
//
// ЭТИ ЖЕ КОДЫ СТОЯТ У ИЗДАНИЙ в `bible_editions.versification`. Список общий
// намеренно: издание и указание устава ссылаются на одну и ту же традицию, и
// разойдись эти два словаря — сверять их стало бы нечем.
export interface Versification {
    id: string;
    label: string;
    /**
     * Эталон: в нём записан canonRef всех изданий, и по нему резолвятся зачала.
     * Эталон в проекте один — сменить его значит переписать все зачала и сноски.
     */
    reference: boolean;
}

export const VERSIFICATIONS: Versification[] = [
    { id: "sla-lxx", label: "славянская (Елизаветинская, счёт Семидесяти)", reference: true },
    { id: "ro-1688", label: "румынская (Сфънта Скриптура, 1688)", reference: false },
    { id: "grc-lxx", label: "греческая (Септуагинта и Патриарший текст)", reference: false },
    { id: "la-vulgata", label: "латинская (Вульгата Климентина, счёт галликанский)", reference: false },
];

/** Эталонная традиция: в её счёте записан canonRef каждого стиха. */
export const REFERENCE_VERSIFICATION_ID =
    VERSIFICATIONS.find((v) => v.reference)!.id;

/**
 * В каком счёте записаны зачала, если у зачала не сказано иное.
 *
 * Нынешние 1067 зачал — из Типикона Русской Церкви, и их «Мф. 1:1–25» значит
 * номера Елизаветинской Библии. Другой устав может разбивать чтения иначе;
 * тогда у его зачал появится своё поле `versification`, а эти останутся при
 * своём — и различить их будет чем.
 */
export const DEFAULT_PERICOPE_VERSIFICATION = "sla-lxx";

const BY_ID = new Map(VERSIFICATIONS.map((v) => [v.id, v]));

export const versification = (id: string | null | undefined): Versification | null =>
    BY_ID.get(id || "") ?? null;

export const versificationLabel = (id: string | null | undefined): string =>
    BY_ID.get(id || "")?.label || id || "";

/** Счёт, в котором записано зачало. Не проставлено — значит славянский. */
export const pericopeVersification = (pericope: { versification?: string | null }): string =>
    pericope.versification || DEFAULT_PERICOPE_VERSIFICATION;

/**
 * Можно ли резолвить зачало напрямую по canonRef.
 *
 * Да — только если его счёт и есть эталонный. Зачало другого счёта пришлось бы
 * сперва привести к эталону, а правил для этого нет и завести их будет отдельной
 * работой. Пока таких зачал нет, но лучше, чтобы день их появления начался с
 * внятного отказа, а не с молча съехавшего чтения.
 */
export const pericopeResolvesDirectly = (pericope: { versification?: string | null }): boolean =>
    pericopeVersification(pericope) === REFERENCE_VERSIFICATION_ID;
