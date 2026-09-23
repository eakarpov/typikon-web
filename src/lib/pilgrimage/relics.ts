// Реестр святынь: где пребывают мощи и их части. Чистая часть — вид записи и
// её проверка; выборки и запись — в ./relicsStore.
//
// СВОЙ РЕЕСТР, А НЕ ЧУЖОЙ. Ни святцы, ни открытые данные этого не знают: в
// Wikidata у 680 объектов «реликвия» нет ни святого, ни места хранения, а в
// снимке dneslov события «перенесение» и «обретение мощей» называют место
// СОБЫТИЯ строкой, а не нынешнее место святыни. Поэтому записи вносятся
// руками, и каждая — с источником: без него запись не сохраняется.
//
// РЕЕСТР ЖИВЁТ В typikon-users, а не в корпусе. Пополняется он на проде: приход
// предлагает запись, разбирающий её принимает, обходчик сайтов храмов находит
// новости о святынях. А `typikon` целиком накатывается выкладкой через
// `mongorestore --drop` и стёр бы всё это первой же выкладкой — ровно то, из-за
// чего туда же уехали приходы и посты канала (см. src/lib/parish/db.ts).
// Предложение — та же запись с состоянием «ждёт разбора», отдельной коллекции
// ему не нужно.
//
// НОВОСТЬ С САЙТА ХРАМА — полноправный источник, но с датой. Святыни
// переносят, а ковчеги с мощами приносят на несколько дней: новость говорит о
// дне своей публикации, и без даты её нельзя ни проверить, ни устареть.

export const RELICS = "relics";
/** Находки обходчика сайтов храмов — сырьё для разбора, не записи реестра. */
export const RELIC_CANDIDATES = "relicCandidates";

export const RELIC_KINDS = {
    moshchi: "мощи",
    glava: "глава",
    chastitsa: "частица мощей",
    raka: "рака (мощи под спудом или перенесены)",
} as const;
export type RelicKind = keyof typeof RELIC_KINDS;

export const RELIC_STATES = {
    present: "пребывают",
    visiting: "принесены на время",
    former: "пребывали прежде",
} as const;
export type RelicState = keyof typeof RELIC_STATES;

export const SOURCE_TYPES = {
    book: "книга или статья",
    news: "новость на сайте храма",
    url: "страница в сети",
    wikidata: "Wikidata",
    parish: "сообщение прихода",
} as const;
export type SourceType = keyof typeof SOURCE_TYPES;

export interface RelicSource {
    type: SourceType;
    ref: string;
    /** Дата публикации ГГГГ-ММ-ДД; обязательна у новости. */
    date?: string;
    note?: string;
}

/** То, что вносится руками; остальное (координаты, имя святого) выводится при записи. */
export interface RelicInput {
    /** Святой — ключ записи нашего каталога (`saints._id`), а не номер святцев: у святых из нашего корпуса номера нет. */
    saintId: string;
    kind: RelicKind;
    state: RelicState;
    templeSlug?: string | null;
    placeId?: string | null;
    /** Где именно в храме или обители: «Троицкий собор, у южной стены». */
    where?: string;
    /** Для принесённых на время: с какого по какой день, ГГГГ-ММ-ДД. */
    visit?: { from: string; to: string };
    source: RelicSource;
    note?: string;
}

export type RelicStatus = "pending" | "approved" | "rejected";

export interface Relic extends RelicInput {
    id: string;
    saintName: string;
    saintSlug: string | null;
    /** Имя храма или места — чтобы список не ходил за ним отдельно. */
    siteName: string;
    location: { type: "Point"; coordinates: [number, number] };
    status: RelicStatus;
    /** Кто внёс или предложил; кто разобрал. */
    createdBy: string | null;
    reviewedBy: string | null;
    createdAt: string;
    updatedAt: string;
}

const LIMITS = { where: 200, ref: 500, note: 1000 };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (s: string) => ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/**
 * Проверка записи до всякой выборки: вид, состояние, место, источник.
 *
 * Источник проверяется по виду: ссылка обязана быть ссылкой, Wikidata —
 * номером Q. Книга — свободной строкой, но непустой: «где это сказано» есть
 * ровно то, чего у этих сведений не хватает везде, и ради чего реестр заведён.
 */
export const validateRelic = (raw: unknown): { ok: true; value: RelicInput } | { ok: false; errors: string[] } => {
    const body = (raw ?? {}) as Record<string, any>;
    const errors: string[] = [];

    const saintId = str(body.saintId);
    if (!/^[a-f0-9]{24}$/.test(saintId)) errors.push("не указан святой или его нет в каталоге");

    const kind = str(body.kind) as RelicKind;
    if (!(kind in RELIC_KINDS)) errors.push("неизвестный вид святыни");

    const state = (str(body.state) || "present") as RelicState;
    if (!(state in RELIC_STATES)) errors.push("неизвестное состояние");

    const templeSlug = str(body.templeSlug) || null;
    const placeId = str(body.placeId) || null;
    if (!templeSlug && !placeId) errors.push("не указано, где святыня: храм или место");
    if (templeSlug && !/^[a-z0-9-]{1,200}$/.test(templeSlug)) errors.push("неверный адрес храма");
    if (placeId && !/^[a-z0-9-]{1,200}$/i.test(placeId)) errors.push("неверный адрес места");

    const visitFrom = str(body.visit?.from);
    const visitTo = str(body.visit?.to);
    const visit = state === "visiting" ? { from: visitFrom, to: visitTo } : undefined;
    if (visit) {
        if (!isIsoDate(visit.from) || !isIsoDate(visit.to)) errors.push("у принесённых на время нужны даты пребывания");
        else if (visit.from > visit.to) errors.push("пребывание кончается раньше, чем начинается");
    }

    const where = str(body.where);
    if (where.length > LIMITS.where) errors.push(`уточнение места длиннее ${LIMITS.where} знаков`);

    const sourceType = str(body.source?.type) as SourceType;
    const ref = str(body.source?.ref);
    const sourceDate = str(body.source?.date);
    const sourceNote = str(body.source?.note);
    if (!(sourceType in SOURCE_TYPES)) errors.push("не указан вид источника");
    if (!ref) errors.push("не указан источник — без него запись не принимается");
    else if (ref.length > LIMITS.ref) errors.push(`источник длиннее ${LIMITS.ref} знаков`);
    else if ((sourceType === "url" || sourceType === "news") && !/^https?:\/\/\S+$/.test(ref)) errors.push("источник-ссылка должен начинаться с http");
    else if (sourceType === "wikidata" && !/^Q\d+$/.test(ref)) errors.push("источник Wikidata — номер вида Q123");
    if (sourceType === "news" && !isIsoDate(sourceDate)) errors.push("у новости нужна дата публикации");
    if (sourceDate && !isIsoDate(sourceDate)) errors.push("дата источника — вида ГГГГ-ММ-ДД");
    if (sourceNote.length > LIMITS.note) errors.push(`пояснение к источнику длиннее ${LIMITS.note} знаков`);

    const note = str(body.note);
    if (note.length > LIMITS.note) errors.push(`примечание длиннее ${LIMITS.note} знаков`);

    if (errors.length) return { ok: false, errors };
    return {
        ok: true,
        value: {
            saintId, kind, state, templeSlug, placeId,
            ...(where ? { where } : {}),
            ...(visit ? { visit } : {}),
            source: {
                type: sourceType, ref,
                ...(sourceDate ? { date: sourceDate } : {}),
                ...(sourceNote ? { note: sourceNote } : {}),
            },
            ...(note ? { note } : {}),
        },
    };
};

/** Ссылка на источник, если он её имеет; книга ссылкой не бывает. */
export const sourceHref = (s: RelicSource): string | null =>
    s.type === "url" || s.type === "news" ? s.ref : s.type === "wikidata" ? `https://www.wikidata.org/wiki/${s.ref}` : null;

/**
 * Показывать ли запись сегодня. Принесённые на время — только в дни
 * пребывания: ковчег, увезённый вчера, на карте «что рядом» был бы обманом.
 */
export const isCurrent = (r: Pick<RelicInput, "state" | "visit">, today: string): boolean =>
    r.state === "present" || (r.state === "visiting" && !!r.visit && r.visit.from <= today && today <= r.visit.to);

/** Пребывает ли святыня в какой-нибудь из дней промежутка — для дней поездки. */
export const overlaps = (r: Pick<RelicInput, "state" | "visit">, from: string, to: string): boolean =>
    r.state === "present" || (r.state === "visiting" && !!r.visit && r.visit.from <= to && from <= r.visit.to);
