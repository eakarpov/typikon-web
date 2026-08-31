import { DEFAULT_BOOK_LANGUAGE } from "@/utils/bookLanguages";
// Что именно уходит наружу.
//
// Здесь белые списки, а не чёрные, и это принципиально: в v1 наружу утекали
// редакторские заметки adminInfo и нормализованные копии текста для поиска — просто
// потому, что их забыли исключить. При белом списке новое внутреннее поле не утечёт
// по забывчивости: чтобы оно попало в ответ, его надо добавить сюда осознанно.
//
// Не отдаём никогда: adminInfo (заметки редактора), searchName/searchContent
// (служебные копии текста), textingPriority (очередь отекстовки), newUi, fileId.

import type { NewsPostDTO } from "@/types/dto/news";
import { pericopeVersification } from "@/utils/versification";

const id = (value: any): string | null =>
    value == null ? null : (typeof value === "string" ? value : value.toString());

const iso = (value: any): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Найденное песнопение. Белый список здесь не лишний, хотя @/lib/chants и так
 * складывает ответ по именованным полям: стоит однажды добавить туда что-то
 * для нужд страницы — и оно молча уйдёт наружу. Здесь этого не случится.
 */
export const chantSummary = (hit: any) => ({
    id: hit.id,
    // Фрагмент кусками: найденное отмечено флагом, а не разметкой внутри строки.
    snippet: (hit.snippet ?? []).map((part: any) => ({ text: part.text, hit: part.hit })),
    unit: hit.unit ?? null,
    ode: hit.ode ?? null,
    marker: hit.marker ?? null,
    placement: hit.placement ?? null,
    memoryId: hit.memoryId ?? null,
    memory: hit.memory ?? null,
    book: hit.book ?? null,
    month: hit.month ?? null,
    day: hit.day ?? null,
    service: hit.service ?? null,
    position: hit.position ?? null,
    tone: hit.tone ?? null,
    sign: hit.sign ?? null,
    // У строфы акафиста нет ни книги, ни дня: её адрес — имя произведения и
    // номер строфы. Без этих полей ответ про неё был бы почти пустым.
    akathist: hit.akathist ?? null,
    stanza: hit.stanza ?? null,
    stanzaKind: hit.stanzaKind ?? null,
});

/** Текст в списке — без тела: именно оно раздувало ответы v1 до сотни килобайт. */
export const textSummary = (doc: any) => ({
    id: id(doc._id ?? doc.id),
    alias: doc.alias || null,
    name: doc.name ?? "",
    description: doc.description || null,
    author: doc.author || null,
    translator: doc.translator || null,
    type: doc.type || null,
    contentType: doc.contentType || null,
    readiness: doc.readiness || null,
    bookId: id(doc.bookId),
    bookIndex: doc.bookIndex ?? null,
    dneslovId: doc.dneslovId || null,
    updatedAt: iso(doc.updatedAt),
});

/** Текст целиком — то, ради чего API и нужен. */
export const textDetail = (doc: any) => ({
    ...textSummary(doc),
    content: doc.content ?? "",
    start: doc.start || null,
    startPhrase: doc.startPhrase || null,
    initialPriestExclamation: doc.initialPriestExclamation || null,
    poems: doc.poems || null,
    footnotes: doc.footnotes ?? [],
    quotes: doc.quotes ?? [],
    // Ссылки на скан и русский перевод — чужие материалы, поэтому именно ссылки.
    scanUrl: doc.link || null,
    russianUrl: doc.ruLink || null,
    images: doc.images?.filter(Boolean) ?? [],
    note: doc.info || null,
    dneslovType: doc.dneslovType || null,
    dneslovEventId: doc.dneslovEventId || null,
    mentionIds: doc.mentionIds ?? [],
    csSource: Boolean(doc.csSource),
    createdAt: iso(doc.createdAt),
});

export const verse = (doc: any) => ({
    id: id(doc._id ?? doc.id),
    chapter: doc.chapter,
    verse: doc.verse,
    content: doc.content ?? "",
});

export const book = (doc: any) => ({
    id: id(doc._id ?? doc.id),
    name: doc.name ?? "",
    author: doc.author || null,
    translator: doc.translator || null,
    description: doc.description || null,
    order: doc.order ?? null,
    // Язык, на котором книга набрана. Коды общие с корпусом typikon-rules,
    // см. @/utils/bookLanguages.
    language: doc.language || DEFAULT_BOOK_LANGUAGE,
    textCount: Array.isArray(doc.texts) ? doc.texts.length : null,
    updatedAt: iso(doc.updatedAt),
});

export const month = (doc: any) => ({
    id: id(doc._id ?? doc.id),
    alias: doc.alias || null,
    value: doc.value ?? null,
    updatedAt: iso(doc.updatedAt),
});

export const week = (doc: any) => ({
    id: id(doc._id ?? doc.id),
    alias: doc.alias || null,
    label: doc.label ?? null,
    type: doc.type ?? null,
    value: doc.value ?? null,
    triodion: Boolean(doc.triodion),
    penticostarion: Boolean(doc.penticostration),
});

export const sign = (doc: any) => ({
    id: id(doc._id ?? doc.id),
    month: doc.month ?? null,
    date: doc.date ?? null,
    name: doc.name ?? "",
    sign: doc.sign ?? null,
    signConditional: Boolean(doc.signConditional),
    isDefault: Boolean(doc.isDefault),
    order: doc.order ?? null,
});

export const pericope = (doc: any) => ({
    id: id(doc._id ?? doc.id),
    source: doc.source ?? null,
    bookSlug: doc.bookSlug ?? null,
    number: doc.number ?? null,
    variant: doc.variant ?? null,
    label: doc.label ?? null,
    ranges: doc.ranges ?? [],
    // В чьём счёте записаны эти ranges. Не проставлено — значит славянский:
    // зачала Типикона Русской Церкви (@/utils/versification). Отдаём наружу,
    // чтобы читающий API не гадал, номера какого издания перед ним.
    versification: pericopeVersification(doc),
    occasions: doc.occasions ?? [],
});

// --- День со слотами службы

/** Один пункт слота: либо текст, либо зачало, иногда и то и другое. */
const slotItem = (item: any) => ({
    cite: item.cite || null,
    description: item.description || null,
    statia: item.statia ?? null,
    paschal: Boolean(item.paschal),
    text: item.text?._id || item.text?.id ? textSummary(item.text) : null,
    pericope: item.pericope
        ? {
            ...pericope(item.pericope),
            textId: id(item.pericope.textId),
            textName: item.pericope.textName ?? null,
            textAlias: item.pericope.textAlias ?? null,
            requestedLang: item.pericope.requestedLang ?? null,
            resolvedLang: item.pericope.resolvedLang ?? null,
            verses: (item.pericope.verses ?? []).map(verse),
        }
        : null,
});

/**
 * Слоты дня приходят полями по имени типа чтения (song6, polyeleos, gospelLiturgy…).
 * Наружу отдаём списком: клиенту не нужно знать имена полей заранее, а порядок
 * следования службы сохраняется.
 */
export const daySlots = (day: any, order: readonly string[], title: (slot: string) => string) =>
    order
        .filter((slot) => day?.[slot]?.items?.length)
        .map((slot) => ({
            slot,
            title: title(slot),
            items: day[slot].items.map(slotItem),
        }));

export const dayDetail = (day: any, order: readonly string[], title: (slot: string) => string) => ({
    id: id(day._id ?? day.id),
    alias: day.alias || null,
    name: day.name ?? "",
    paschal: Boolean(day.paschal),
    monthIndex: day.monthIndex ?? null,
    weekIndex: day.weekIndex ?? null,
    week: day.week ? week(day.week) : null,
    month: day.month ? month(day.month) : null,
    readings: daySlots(day, order, title),
    updatedAt: iso(day.updatedAt),
});

export const memory = (item: any) => ({
    id: item.id ?? null,
    name: item.name ?? "",
    sign: item.sign ?? null,
    signConditional: Boolean(item.signConditional),
});

/**
 * Новость наружу. Черновиков сюда не попадает — выборка их не отдаёт, — поэтому
 * состояние в ответе не нужно: всё, что видно снаружи, опубликовано.
 */
export const newsItem = (post: NewsPostDTO) => ({
    id: post.id,
    alias: post.alias,
    title: post.title,
    summary: post.summary,
    body: post.body,
    type: post.type,
    version: post.version,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
});

// --- Библия ------------------------------------------------------------------
//
// Наружу отдаём обе нумерации: каноническую (по ней стих сходится с другими
// изданиями и по ней названо зачало) и родную (по ней стих ищут в самой книге).
// Клиенту, читающему одно издание, вторая не мешает; клиенту, сводящему издания,
// без первой не обойтись.

export const bibleEdition = (doc: any) => ({
    code: doc.code,
    title: doc.title,
    shortTitle: doc.shortTitle,
    language: doc.language,
    languageCode: doc.langCode,
    versification: doc.versification,
    year: doc.year ?? null,
    sourceUrl: doc.sourceLink || null,
});

export const bibleVerse = (doc: any) => ({
    id: id(doc._id ?? doc.id),
    canonRef: doc.canonRef,
    chapter: doc.canonChapter ?? doc.chapter,
    verse: doc.canonVerse ?? doc.verse,
    // Как этот же стих пронумерован в самом издании.
    editionChapter: doc.chapter,
    editionVerse: doc.verse,
    content: doc.content ?? "",
});
