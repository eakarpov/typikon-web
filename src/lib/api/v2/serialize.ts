// Что именно уходит наружу.
//
// Здесь белые списки, а не чёрные, и это принципиально: в v1 наружу утекали
// редакторские заметки adminInfo и нормализованные копии текста для поиска — просто
// потому, что их забыли исключить. При белом списке новое внутреннее поле не утечёт
// по забывчивости: чтобы оно попало в ответ, его надо добавить сюда осознанно.
//
// Не отдаём никогда: adminInfo (заметки редактора), searchName/searchContent
// (служебные копии текста), textingPriority (очередь отекстовки), newUi, fileId.

const id = (value: any): string | null =>
    value == null ? null : (typeof value === "string" ? value : value.toString());

const iso = (value: any): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
};

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
    bibleBookSlug: doc.bibleBookSlug || null,
    csSource: Boolean(doc.csSource),
    createdAt: iso(doc.createdAt),
    ...(doc.verses ? { verses: doc.verses.map(verse) } : {}),
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
    occasions: doc.occasions ?? [],
});
