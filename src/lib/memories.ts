// Реестр памятей: доступ к данным для страниц /memories.
//
// ПАМЯТЬ — НЕ СВЯТОЙ. Это СЛУЖБА, назначенная книгой на своё место, и место
// это у каждой книги своё: у Минеи число месяца, у Триодей отступ от Пасхи, у
// Октоиха глас и день седмицы, у Общей Минеи разряд святого. Святой при ней
// бывает, а бывает и нет: под иконой, Господним праздником или собором лица
// нет вовсе или их много. Оттого раздел отдельный от /saints, а не вкладка в
// нём.
//
// Данные приходят выгрузкой из корпуса (npm run memories:import) и здесь
// только читаются: разбор устава живёт в typikon-rules, и мнения о нём у
// портала нет.
import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";

export interface SignSource {
    method: string;
    sign: string | null;
    evidence: string | null;
    sourceBook: string | null;
    sourceUrl: string | null;
}

export interface Memory {
    memoryId: string;
    book: string;
    /** Чем книга адресует память: date | pascha | tone | category */
    addressBy: string;
    label: string;
    month: number | null;
    day: number | null;
    paschaOffset: number | null;
    tone: number | null;
    weekday: string | null;
    category: string | null;
    variantOf: string | null;
    dneslovId: string | null;
    sign: {
        default: string | null;
        method: string | null;
        evidence: string | null;
        tipikon: string | null;
        book: string | null;
        bookAbsence: string | null;
        heuristic: string | null;
        sources: SignSource[];
    } | null;
    feastCycle: {
        kind: string | null;
        dayNo: number | null;
        feastMonth: number | null;
        feastDay: number | null;
        feastLabel: string | null;
    } | null;
    serviceRefs: { month: number | null; day: number | null; text: string | null }[];
}

export const BOOK_LABELS: Record<string, string> = {
    "menaion": "Минея",
    "triod-postnaya": "Триодь постная",
    "triod-tsvetnaya": "Триодь цветная",
    "octoechos": "Октоих",
    "obshaya-mineya": "Минея общая",
};

export const WEEKDAY_LABELS: Record<string, string> = {
    "ponedelnik": "понедельник", "vtornik": "вторник", "sreda": "среда",
    "chetverg": "четверг", "pyatnitsa": "пятница", "subbota": "суббота",
    "voskresenie": "воскресенье",
};

export const CYCLE_LABELS: Record<string, string> = {
    "predprazdnstvo": "предпразднство",
    "poprazdnstvo": "попразднство",
    "otdanie": "отдание",
    "prazdnik": "самый праздник",
};

// Откуда взят знак службы. Их три, и они РАЗНЫЕ по силе: Типикон говорит
// прямо, печать книги — тем, что напечатала, а строение службы — тем, чего в
// ней не хватает. Портал показывает все, а не один победивший: расхождение
// между ними — сведение, а не сбой.
export const METHOD_LABELS: Record<string, string> = {
    "tipikon": "назван Типиконом",
    "book": "по знаку в книге",
    "book-absence": "по отсутствию службы в книге",
    "heuristic": "выведено по строению службы",
};

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля",
    "августа", "сентября", "октября", "ноября", "декабря"];

/** Адрес памяти словами — тем способом, каким её адресует её же книга. */
export const addressOf = (m: Memory): string => {
    const book = BOOK_LABELS[m.book] ?? m.book;
    if (m.addressBy === "date" && m.month && m.day) {
        return `${book}, ${m.day} ${MONTHS[m.month - 1] ?? ""}`.trim();
    }
    if (m.addressBy === "pascha" && m.paschaOffset !== null) {
        const n = m.paschaOffset;
        if (n === 0) return `${book}, Пасха`;
        return n > 0 ? `${book}, ${n}-й день по Пасхе`
            : `${book}, за ${-n} дней до Пасхи`;
    }
    if (m.addressBy === "tone") {
        const parts = [book];
        if (m.tone) parts.push(`глас ${m.tone}`);
        if (m.weekday) parts.push(WEEKDAY_LABELS[m.weekday] ?? m.weekday);
        return parts.join(", ");
    }
    if (m.addressBy === "category" && m.category) return `${book}, ${m.category}`;
    return book;
};

export const getMemory = cached(async (memoryId: string): Promise<Memory | null> => {
    const db = (await clientPromise).db("typikon");
    const row = await db.collection("memories").findOne({ _id: memoryId as any });
    return row ? (JSON.parse(JSON.stringify(row)) as Memory) : null;
}, ["memory"], [CacheTag.MEMORIES]);

export const getMemoryRows = cached(async (): Promise<Memory[]> => {
    const db = (await clientPromise).db("typikon");
    const rows = await db.collection("memories")
        .find({}, { projection: { serviceRefs: 0, "sign.sources": 0 } })
        .sort({ book: 1, month: 1, day: 1, paschaOffset: 1, tone: 1, _id: 1 })
        .toArray();
    return JSON.parse(JSON.stringify(rows)) as Memory[];
}, ["memory-rows"], [CacheTag.MEMORIES]);

/**
 * Святой, если связь с ним ПОДТВЕРЖДЕНА человеком.
 *
 * Неподтверждённых не показываем вовсе: кандидат — это догадка сопоставителя,
 * и выдать её за сведение значило бы приписать памяти чужое лицо. Их место в
 * админке, а не на странице.
 */
export const getLinkedSaint = cached(async (memoryId: string) => {
    const db = (await clientPromise).db("typikon");
    const link = await db.collection("memory_saint_links")
        .findOne({ memoryId, status: "approved" });
    if (!link?.dneslovId) return null;
    const saint = await db.collection("saints")
        .findOne({ "externals.id": String(link.dneslovId) });
    return saint ? JSON.parse(JSON.stringify(saint)) : null;
}, ["memory-saint"], [CacheTag.MEMORIES, CacheTag.SAINTS]);

/** Строка памяти на карточке святого: адрес книги и знак службы, больше ничего. */
export interface SaintMemoryRow {
    memoryId: string;
    label: string;
    /** Адрес книги словами — тот же, что и на странице памяти (addressOf). */
    address: string;
    /** Код знака; подпись к нему — SIGN_LABELS, они и на показе, и в корпусе одни. */
    sign: string | null;
}

/**
 * Памяти, отнесённые к этому лицу, — обратная сторона getLinkedSaint.
 *
 * Только ВЫВЕРЕННЫЕ связи, по той же причине: кандидат сопоставителя — догадка,
 * и на карточке святого она выглядела бы как сведение о службе, которой ему,
 * может, никто не назначал. Оттого у большинства святых раздел пока пуст: из
 * 653 связей выверено 88, остальные ждут разбора в /admin/mentions.
 *
 * Номеров святцев у записи бывает несколько (две памяти, сведённые нами в одно
 * лицо), поэтому на входе набор, а не номер.
 */
export const memoriesOfSaint = cached(async (dneslovIds: string[]): Promise<SaintMemoryRow[]> => {
    const ids = [...new Set((dneslovIds ?? []).filter(Boolean).map(String))];
    if (!ids.length) return [];

    const db = (await clientPromise).db("typikon");
    const links = await db.collection("memory_saint_links")
        .find({ dneslovId: { $in: ids }, status: "approved" }, { projection: { memoryId: 1 } })
        .toArray();
    const memoryIds = [...new Set(links.map((l: any) => l.memoryId).filter(Boolean))];
    if (!memoryIds.length) return [];

    const rows = await db.collection("memories")
        .find({ _id: { $in: memoryIds as any[] } }, { projection: { serviceRefs: 0, "sign.sources": 0 } })
        .sort({ book: 1, month: 1, day: 1, paschaOffset: 1, tone: 1, _id: 1 })
        .toArray();

    return (JSON.parse(JSON.stringify(rows)) as Memory[]).map((m) => ({
        memoryId: m.memoryId,
        label: m.label,
        address: addressOf(m),
        sign: m.sign?.default ?? null,
    }));
}, ["saint-memories"], [CacheTag.MEMORIES, CacheTag.SAINTS]);
