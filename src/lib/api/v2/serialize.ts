import { DEFAULT_BOOK_LANGUAGE } from "@/utils/bookLanguages";
import { jdnToGregorian, jdnToJulian, weekdayOf } from "@/utils/chronology";
import { baseYearLabel, kindLabel, memoryDaysOf, orderLabel } from "@/lib/saintFacts";
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
    // На каком языке найденное. Без этого поля славянскую стихиру не отличить
    // от румынской, а корпус четырёхъязычный.
    language: hit.language ?? null,
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
    // Издание, откуда строка. Одно место службы печатают несколько изданий, и
    // без этого поля две строки одного места неразличимы снаружи. Просили ещё
    // при выносе поиска наружу — отдаём теперь.
    sourceBook: hit.sourceBook ?? null,
});

/**
 * Песнопение целиком — то, что обещал `sampleId` указателя зачинов.
 *
 * Обещание стояло в описании: «чтобы за ним можно было сходить в
 * /api/v2/chants». Сходить было некуда — та ручка принимает запрос, а не
 * идентификатор, и всякое вхождение зачина оставалось без текста.
 *
 * `borrowed` и `textItemId` отдаются вместе: книга печатает ирмос зачином, а
 * полный текст лежит в Ирмологии, и подставленный текст надо назвать
 * подставленным. `textItemId` при этом говорит, ЧЬЯ это строка, — по ней
 * посчитаны смещения цитат, и приложенные к чужой строке они уехали бы молча.
 */
export const chantDetail = (row: any) => ({
    id: row.id,
    text: row.text ?? "",
    borrowed: row.borrowed === true,
    textItemId: row.textItemId ?? null,
    language: row.language ?? null,
    unit: row.unit ?? null,
    marker: row.marker ?? null,
    markerAlt: row.markerAlt ?? null,
    placement: row.placement ?? null,
    /** Сколько раз строка поётся: указание книги, а не украшение. */
    repeat: row.repeat ?? 1,
    ode: row.ode ?? null,
    stanza: row.stanza ?? null,
    stanzaKind: row.stanzaKind ?? null,
    tone: row.tone ?? null,
    /** Подобен, как его напечатала книга: по нему напев выбирается прежде гласа. */
    podoben: row.podoben ?? null,
    service: row.service ?? null,
    position: row.position ?? null,
    groupLabel: row.groupLabel ?? null,
    memoryId: row.memoryId ?? null,
    memory: row.memory ?? null,
    book: row.book ?? null,
    month: row.month ?? null,
    day: row.day ?? null,
    paschaOffset: row.paschaOffset ?? null,
    weekday: row.weekday ?? null,
    memoryTone: row.memoryTone ?? null,
    sign: row.sign ?? null,
    akathist: row.akathist ?? null,
    canonId: row.canonId ?? null,
    /** Издание, откуда строка, — то же, что у находки поиска. */
    sourceBook: row.sourceBook ?? null,
});

/** Зачин в указателе: ключ, число вхождений и представительное из них. */
export const incipitSummary = (row: any) => ({
    incipit: row.incipit,
    language: row.language,
    uses: row.uses,
    // По какому именно вхождению показан текст — чтобы за ним можно было
    // сходить в /api/v2/chants и не гадать, которое из ста тридцати четырёх.
    sampleId: row.sampleId,
    text: row.text ?? "",
    unit: row.unit ?? null,
    book: row.book ?? null,
    memory: row.memory ?? null,
    akathist: row.akathist ?? null,
});

/** Одно вхождение зачина: где именно в книге оно стоит. */
const incipitWitness = (w: any) => ({
    id: w.id,
    language: w.language,
    unit: w.unit ?? null,
    ode: w.ode ?? null,
    stanza: w.stanza ?? null,
    stanzaKind: w.stanzaKind ?? null,
    marker: w.marker ?? null,
    placement: w.placement ?? null,
    tone: w.tone ?? null,
    service: w.service ?? null,
    position: w.position ?? null,
    memoryId: w.memoryId ?? null,
    memory: w.memory ?? null,
    book: w.book ?? null,
    month: w.month ?? null,
    day: w.day ?? null,
    paschaOffset: w.paschaOffset ?? null,
    weekday: w.weekday ?? null,
    akathist: w.akathist ?? null,
    canonId: w.canonId ?? null,
    sourceBook: w.sourceBook ?? null,
});

/**
 * Соответствие на другом языке — вместе с тем, на чём оно держится.
 *
 * `method` и `confidence` отдаём НАРУЖУ намеренно, а не прячем за одним флагом
 * «перевод». Клиент, которому связь нужна для сличения, обязан видеть разницу
 * между заявленным издателем (`edition`/`certain`: у AGES греческий и
 * английский слои стоят на одном ключе) и нашей догадкой по совпавшему месту
 * службы (`structure`/`candidate`), которая бывает ложной. Отдать их
 * вперемешку значило бы переложить нашу неуверенность на чужой продукт молча.
 */
const incipitCorrespondence = (t: any) => ({
    id: t.id,
    language: t.language,
    text: t.text ?? "",
    incipit: t.incipit ?? null,
    method: t.method,
    confidence: t.confidence,
    evidence: t.evidence ?? null,
});

/** Зачин целиком: все вхождения и все соответствия, разделённые по доверию. */
export const incipitDetail = (found: any) => ({
    incipit: found.incipit,
    language: found.language,
    uses: found.uses,
    text: found.text ?? "",
    borrowed: Boolean(found.borrowed),
    witnesses: (found.witnesses ?? []).map(incipitWitness),
    correspondences: {
        declared: (found.declared ?? []).map(incipitCorrespondence),
        supposed: (found.supposed ?? []).map(incipitCorrespondence),
    },
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

// --- Именины -----------------------------------------------------------------

const imeninySaint = (saint: any) => ({
    slug: saint.slug,
    name: saint.name,
    /**
     * `guess` — имя вынуто из соборной памяти, где перечень идёт вперемешку, и
     * ошибиться там легко. Признак уходит наружу обязательно: догадка, выданная
     * за факт, здесь стоит дороже обычного — речь о том, когда человеку
     * праздновать.
     */
    confidence: saint.confidence ?? "sure",
});

const imeninyMemory = (memory: any) => ({
    date: memory.date,
    /** Подвижная память в другой год придётся на другое число. */
    movable: memory.movable,
    saint: imeninySaint(memory.item),
});

export const imeninyEntry = (entry: any, year: number, memories: any[], chosen: any) => ({
    key: entry.key,
    name: entry.name,
    /** Год, в котором разложены даты: подвижные памяти от него и зависят. */
    year,
    saints: (entry.saints ?? []).map(imeninySaint),
    memories: memories
        .slice()
        .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
        .map(imeninyMemory),
    /** Именины по дню рождения — только если день рождения назван. */
    nameDay: chosen ? imeninyMemory(chosen) : null,
    /**
     * Оговорка уходит вместе с ответом, а не остаётся на нашей странице: всякий,
     * кто возьмёт эту дату, обязан знать, чем она является.
     */
    caveat: "Правило «ближайшая память после дня рождения» — народный обычай, а не "
        + "устав. Церковь единого порядка не устанавливает: где-то именины назначают "
        + "по дню крещения, где-то по восьмому дню от рождения, где-то по святому, "
        + "чьё имя дали.",
});

// --- Хронология --------------------------------------------------------------

const chronologyDay = (jdn: number | null) =>
    jdn === null
        ? null
        : {
              jdn,
              /** Как записано в источнике — юлианским счётом. */
              julian: chronologyYmd(jdnToJulian(jdn)),
              /** И то же число нынешним календарём. */
              civil: chronologyYmd(jdnToGregorian(jdn)),
              weekday: weekdayOf(jdn),
          };

const chronologyYmd = (date: { year: number; month: number; day: number }) =>
    `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;

const chronologyCandidate = (candidate: any) => ({
    label: candidate.label,
    leto: candidate.leto,
    /** Счета эры, давшие один и тот же ответ и потому сведённые в одну строку. */
    styles: candidate.styles,
    note: candidate.note ?? null,
    /** Все семь чисел лета. */
    marks: {
        indikt: candidate.marks.indikt,
        krugSolntsu: candidate.marks.krugSolntsu,
        krugLune: candidate.marks.krugLune,
        vrutseleto: candidate.marks.vrutseleto,
        vrutseletoLetter: candidate.marks.vrutseletoLetter,
        osnovanie: candidate.marks.osnovanie,
        epakta: candidate.marks.epakta,
        klyuchGranits: candidate.marks.klyuchGranits,
        vysokosniy: candidate.marks.vysokosniy,
        pascha: chronologyDay(candidate.marks.paschaJdn),
    },
    day: chronologyDay(candidate.jdn),
    fits: candidate.fits,
    /**
     * На чём не сошлось. Голого «не подошёл» мало: перебор читают, чтобы
     * увидеть причину, а не приговор.
     */
    failedOn: candidate.failedOn ?? null,
    checks: candidate.checks,
});

export const chronologyAnswer = (
    record: any,
    span: { from: number; to: number },
    result: any,
    verdict: any,
    fixes: any[],
    ignored: string[],
) => ({
    record,
    searched: span,
    /**
     * Условия, которые назвали, но прочесть не удалось, — и потому в переборе
     * они не участвовали. Молчать об этом нельзя: ответ выглядел бы
     * подтверждённым тем, чего в нём нет.
     */
    ignored,
    verdict: { kind: verdict.kind, text: verdict.text },
    considered: result.considered,
    applied: result.applied,
    /** Условие -> скольких кандидатов оно отсеяло. */
    killed: result.killed,
    killedByDate: result.killedByDate,
    survivors: result.survivors.map(chronologyCandidate),
    /**
     * Поправки, а не «без индикта что-то есть»: какое чтение потребовалось бы на
     * месте выброшенного условия. «Читать индикт не 6, а 7, и всё сходится на
     * 1204» — довод, с которым можно идти к рукописи.
     *
     * Считаются только когда не уцелел никто: у сошедшейся записи разбирать
     * нечего.
     */
    fixes: fixes.map((fix: any) => ({
        field: fix.field,
        label: fix.label,
        stated: fix.stated ?? null,
        needed: fix.needed ?? null,
        size: fix.size ?? null,
        note: fix.note ?? null,
        candidate: chronologyCandidate(fix.candidate),
    })),
});

// --- Словарь -----------------------------------------------------------------

export const lexemeSummary = (found: any) => ({
    id: found.id,
    name: found.name,
    /** Пометы словаря как есть — «S,m,anim». Разбирать их за клиента не беремся. */
    properties: found.properties ?? "",
    pos: found.pos ?? "other",
    /** Схема склонения по книге; по ней и порождается парадигма. */
    scheme: found.scheme ?? "",
});

/**
 * Ячейка парадигмы. `stored` — выписана ли форма в словаре или порождена по
 * таблице: факт и вывод, и разница между ними стоит того, чтобы её видеть.
 */
const lexemeSlot = (slot: string, forms: any[]) => ({
    slot,
    forms: (forms ?? []).map((form: any) => ({
        value: form.value,
        stored: form.stored === true,
    })),
});

const lexemeParadigm = (kind: string, table: any, title: string | null = null, base: string | null = null) => ({
    kind,
    title,
    base,
    // Порядок ячеек — наш и осмысленный: идущему подряд его достаточно, чтобы
    // разложить таблицу, не зная наших схем.
    slots: Object.keys(table ?? {}).map(slot => lexemeSlot(slot, table[slot])),
});

export const lexemeDetail = (view: any) => {
    const paradigms: any[] = [];

    if (view.noun) paradigms.push(lexemeParadigm("noun", view.noun));
    if (view.adjective) {
        paradigms.push(lexemeParadigm("adjective-brev", view.adjective.brev));
        paradigms.push(lexemeParadigm("adjective-plen", view.adjective.plen));
    }
    if (view.verb) paradigms.push(lexemeParadigm("verb", view.verb));
    for (const participle of view.participles ?? []) {
        paradigms.push(lexemeParadigm(
            "participle-brev", participle.table.brev, participle.title, participle.base,
        ));
        paradigms.push(lexemeParadigm(
            "participle-plen", participle.table.plen, participle.title, participle.base,
        ));
    }

    return {
        id: view.id,
        name: view.name,
        scheme: view.scheme,
        pos: view.pos,
        properties: view.properties ?? [],
        /**
         * Есть ли для схемы таблица. Нет — парадигмы не будет вовсе, и остаются
         * одни выписанные формы. Сказать об этом надо: пустая таблица иначе
         * читается как «слово не склоняется».
         */
        known: view.known === true,
        paradigms,
        /** Формы словаря, не легшие ни в одну ячейку: сокращения под титлом и прочее. */
        extra: (view.extra ?? []).map((form: any) => ({
            value: form.value,
            properties: form.properties ?? "",
        })),
    };
};

// --- Досье святого -----------------------------------------------------------

const saintMemoryRow = (row: any) => ({
    memoryId: row.memoryId,
    label: row.label,
    /** Адрес памяти в месяцеслове — «16.12». */
    address: row.address ?? null,
    /** Знак службы по Типикону: им память и отличается от прочих в тот же день. */
    sign: row.sign ?? null,
});

const saintDedicationRow = (row: any) => ({
    slug: row.slug,
    short: row.short ?? null,
    label: row.label ?? null,
    /** Сколько храмов с этим посвящением в каталоге. */
    count: row.count ?? 0,
});

const saintAkathist = (row: any) => ({
    id: row.akathist_id ?? row.id ?? null,
    title: row.title ?? null,
    memory: row.memory ?? null,
    stanzas: row.stanzas ?? null,
});

export const saintDossier = (saint: any, parts: any) => ({
    slug: saint.slug ?? null,
    name: saint.name ?? saint.title ?? null,
    /** Прочие именования: варианты, прозвания, мирское имя при монашеском. */
    altNames: saint.altNames ?? [],
    kind: saint.type ?? null,
    kindLabel: kindLabel(saint.type),
    orders: (saint.orders ?? []).map((code: string) => ({ code, label: orderLabel(code) })),
    baseYear: saint.baseYear ?? null,
    baseYearLabel: baseYearLabel(saint.baseYear),
    /**
     * Дни памяти, разложенные в гражданский календарь. Переходящие у святцев
     * записаны смещением, и без разбора клиенту их не поставить.
     */
    memoryDates: memoryDaysOf(saint.memoryDates, new Date()),
    roundelUrl: saint.roundelUrl ?? null,
    images: (saint.images ?? []).map((image: any) => ({
        url: image.url,
        thumbUrl: image.thumbUrl ?? null,
        title: image.title ?? null,
    })),
    /**
     * Внешние ключи. Номеров святцев у записи бывает несколько: одно лицо,
     * разведённое календарём на две памяти.
     */
    externals: (saint.externals ?? []).map((e: any) => ({ source: e.source, id: String(e.id) })),

    memories: (parts.memories ?? []).map(saintMemoryRow),
    texts: (parts.texts ?? []).map(textSummary),
    mentions: (parts.mentions ?? []).map(textSummary),
    /**
     * `null` — корпус певческих текстов на этом сервере не выложен, и акафисты
     * мы не смотрели вовсе. `[]` — смотрели и не нашли. Разница та же, что между
     * `corpus_unavailable` и пустой выдачей поиска.
     */
    akathists: parts.akathists === null ? null : parts.akathists.map(saintAkathist),
    dedications: (parts.dedications ?? []).map(saintDedicationRow),
    /** Только ссылка: правления князей не показываются пока и на сайте. */
    noble: parts.noble ? { id: String(parts.noble.id), name: parts.noble.name ?? null } : null,

    /**
     * Оговорка едет в ответе, потому что без неё пустой раздел читается как
     * утверждение. Связи выверены меньше чем наполовину, и «храмов нет» здесь
     * почти всегда значит «связь не проставлена».
     */
    caveat: "Пустой раздел чаще значит, что связь ещё не проставлена, чем что её нет: "
        + "памяти, посвящения и акафисты сверяются вручную, и выверена пока меньшая часть.",
});

// --- Помянник ----------------------------------------------------------------
//
// Здесь белый список нужнее, чем где-либо ещё в этом файле: наружу идут не тексты
// корпуса, а имена родни и даты смерти. `userId` и `fromUserId` не выходят
// никогда — ни в лице, ни в записке.

/**
 * Лицо помянника.
 *
 * `relation` («мама», «крёстный») ВЫХОДИТ, хотя в записку не идёт: он для того и
 * заведён, чтобы хозяин не спутал двух Николаев, и без него список лиц — это
 * список одинаковых строк. В записку его не пустит `snapshot()`, а не отбор здесь.
 */
export const pomyannikPerson = (doc: any) => ({
    id: id(doc._id ?? doc.id),
    name: doc.name ?? "",
    churchName: doc.churchName ?? null,
    kind: doc.kind ?? "living",
    sex: doc.sex ?? null,
    rank: doc.rank ?? null,
    relation: doc.relation ?? null,
    born: doc.born ?? null,
    baptized: doc.baptized ?? null,
    died: doc.died ?? null,
    nameDay: doc.nameDay
        ? {
            source: doc.nameDay.source ?? "auto",
            style: doc.nameDay.style ?? null,
            month: doc.nameDay.month ?? null,
            day: doc.nameDay.day ?? null,
            // Подвижная память записана смещением от Пасхи, и числа у неё нет
            // вовсе: в другой год она придётся на другое число.
            offset: doc.nameDay.offset ?? null,
            saint: doc.nameDay.saint ?? null,
        }
        : null,
    sorokoust: doc.sorokoust
        ? { from: doc.sorokoust.from, where: doc.sorokoust.where ?? null }
        : null,
    groups: doc.groups ?? [],
    order: doc.order ?? 0,
});

export const upcomingEvent = (event: any) => ({
    date: event.date,
    kind: event.kind,
    personId: event.personId ?? null,
    name: event.name ?? null,
    years: event.years ?? null,
    title: event.title,
    /** День не уставный — сказать об этом обязана и выдача, а не только страница. */
    custom: event.custom ?? false,
    note: event.note ?? null,
});

export const memorialDay = (day: any) => ({
    date: day.date,
    name: day.name,
    custom: day.custom ?? false,
    note: day.note ?? null,
});

/**
 * Чин с его начертаниями.
 *
 * `cs: null` — не «нет формы», а «книгой не подтверждено»: пять помет
 * («болящий», «путешествующий», «заключённый», «непраздная», «убиенный») в
 * словаре лексем не нашлись, и придумывать за книгу церковнославянское написание
 * мы не станем. Клиент обязан донести этот `null` до записки как есть.
 */
export const rankInfo = (rank: any) => ({
    key: rank.key,
    label: rank.label,
    genitive: rank.genitive,
    cs: rank.cs ?? null,
    feminine: rank.feminine
        ? {
            label: rank.feminine.label,
            genitive: rank.feminine.genitive,
            cs: rank.feminine.cs ?? null,
        }
        : null,
    only: rank.only ?? null,
});

export const noteKindInfo = (kind: any) => ({
    key: kind.key,
    label: kind.label,
    /** Кого можно вписать: панихида о живых не служится, молебен об усопших — тоже. */
    about: kind.about,
    /** Сколько дней длится поминовение. 0 — разовое. */
    days: kind.days,
    note: kind.note ?? "",
});

/**
 * Имя в записке.
 *
 * `slavonicSource` выходит обязательно. Без него читающий примет наш именительный
 * падеж за проверенный родительный и отдаст записку с ошибкой, которой сам бы не
 * сделал, — это худшее, что здесь возможно (см. lib/pomyannik/slavonic).
 */
export const noteName = (name: any) => ({
    name: name.name,
    churchName: name.churchName ?? null,
    slavonic: name.slavonic ?? null,
    slavonicSource: name.slavonicSource ?? null,
    kind: name.kind,
    rank: name.rank ?? null,
    sex: name.sex ?? null,
});

/**
 * Поданная записка — в том виде, в каком её читает священник.
 *
 * `fromUserId` не выходит: кто подал, читающему не нужно, а это личность третьего
 * лица. Стёртая по сроку записка приходит с пустыми именами и непустым
 * `namesCount` — «было столько-то» переживает чистку нарочно.
 */
export const zapiska = (note: any) => ({
    id: id(note._id ?? note.id),
    kind: note.kind,
    names: (note.names ?? []).map(noteName),
    namesCount: note.namesCount ?? 0,
    span: note.span ? { from: note.span.from, to: note.span.to } : null,
    createdAt: iso(note.createdAt),
    readAt: iso(note.readAt),
    finishedAt: iso(note.finishedAt),
    sweptAt: iso(note.sweptAt),
});

// --- Каноны, акафисты, молитвы ------------------------------------------------
//
// Три раздела певческого корпуса, до сих пор жившие только страницами сайта.
// Белый список здесь тот же, что и везде, и нужен он не меньше: строки корпуса
// несут служебные поля разбора (`parsing_confidence`, `slot_key`), которым
// наружу незачем.

/** Канон в перечне. */
export const canonSummary = (row: any) => ({
    id: row.id,
    /** Кому канон: метка памяти, под которой он напечатан. */
    memory: row.memory ?? null,
    memoryId: row.memoryId ?? null,
    book: row.book ?? null,
    month: row.month ?? null,
    day: row.day ?? null,
    paschaOffset: row.paschaOffset ?? null,
    weekday: row.weekday ?? null,
    /** Глас памяти (у Октоиха) — не то же, что глас самого канона. */
    memoryTone: row.memoryTone ?? null,
    tone: row.tone ?? null,
    /**
     * Надписание, КАК НАПЕЧАТАНО книгой, и лицо, с которым оно отождествлено, —
     * порознь. Напечатанное есть свидетельство, отождествление — вывод из него,
     * и вывод бывает неверен. Где отождествления нет, остаётся надписание:
     * гадать за книгу мы не станем.
     */
    creator: row.creator ?? null,
    author: row.author ?? null,
    authorCentury: row.authorCentury ?? null,
    /** Каким свидетелем отождествлено: надписание, греческий подлинник, документ. */
    authorMethod: row.authorMethod ?? null,
    acrostic: row.acrostic ?? null,
    service: row.service ?? null,
    role: row.role ?? null,
    /** Сколько песней и сколько строк — чтобы перечень был осязаем без открытия. */
    odes: row.odes ?? 0,
    items: row.items ?? 0,
});

const canonLine = (line: any) => ({
    unit: line.unit ?? null,
    text: line.text ?? "",
    /**
     * Текста своего нет — он взят по ссылке. Книги печатают ирмос зачином
     * («Ирмо́с: Христо́с ражда́ется:»), а полный текст лежит в Ирмологии или в
     * соседнем каноне; неподписанный, он выдавался бы за напечатанный здесь.
     */
    borrowed: line.borrowed === true,
    marker: line.marker ?? null,
    /** Сколько раз поётся: «Ирмо́с по два́жды» — указание книги, а не украшение. */
    repeat: line.repeat ?? 1,
});

/**
 * Канон целиком.
 *
 * **Номер песни — тот, что стоит в книге, а не порядковый.** Второй песни нет
 * ни у кого, кроме Великого канона, а трипеснцы Триоди несут три и меньше:
 * «Песнь 3» после «Песни 1» — это как напечатано, а не пропуск разбора.
 * Перенумеровав их подряд, клиент «починит» пропуск, которого нет.
 */
export const canonDetail = (row: any) => ({
    ...canonSummary(row),
    odesList: (row.odesList ?? []).map((ode: any) => ({
        ode: ode.ode,
        irmos: (ode.irmos ?? []).map(canonLine),
        troparia: (ode.troparia ?? []).map(canonLine),
    })),
});

/** Акафист в перечне. */
export const akathistSummary = (row: any) => ({
    id: row.id,
    title: row.title ?? "",
    /**
     * Кому акафист. Не памяти и не святому одно вместо другого: акафист
     * Богородице пред иконой обращён к иконе, а не к лицу святцев. `inoe` —
     * не отговорка, а то, что стоит в источнике: Кресту, Ангелам, ко
     * Причащению, о упокоении и покаянный.
     */
    subjectKind: row.subjectKind ?? null,
    /**
     * `ustavny` — положен уставом; таких один. Прочие собраны ради корпуса и в
     * сборку служб не идут, и раздел, умолчавший об этом, читался бы как устав.
     */
    status: row.status ?? null,
    dneslovId: row.dneslovId ?? null,
    memoryId: row.memoryId ?? null,
    memory: row.memory ?? null,
    stanzas: row.stanzas ?? 0,
    /** Проимиев бывает несколько, и счёт у них свой, сквозной по ним. */
    prooimia: row.prooimia ?? 0,
});

const akathistStanza = (line: any) => ({
    /** Порядок чтения; он же порядок показа. */
    index: line.index,
    /**
     * Проимий или строфа акростиха. Различает именно это поле, а не номер:
     * акростишный «кондак 2» и второй проимий — разные строки с одним числом.
     */
    kind: line.kind ?? null,
    unit: line.unit ?? null,
    stanza: line.stanza ?? null,
    /**
     * Буква краегранесия. У Великого акафиста двадцать четыре строфы идут по
     * греческому алфавиту, и это не украшение: недостающая буква значит
     * потерянную строфу.
     */
    letter: line.letter ?? null,
    text: line.text ?? "",
});

/** Акафист целиком, вместе с молитвами, что печатаются при нём. */
export const akathistDetail = (row: any, prayers: any[] = []) => ({
    ...akathistSummary(row),
    /** Рефрен: им кончается каждая строфа своего рода, по нему акафист и опознают. */
    refrainIkos: row.refrainIkos ?? null,
    refrainKontakion: row.refrainKontakion ?? null,
    sourceBook: row.sourceBook ?? null,
    sourceUrl: row.sourceUrl ?? null,
    stanzasList: (row.lines ?? []).map(akathistStanza),
    /**
     * Молитва при акафисте — не строфа: у неё нет ни номера, ни места в
     * акростихе, и живёт она своей сущностью. Но печатается здесь же, и
     * читателю нужна здесь же.
     */
    prayers: prayers.map(prayerSummary),
});

/** Молитва в перечне. */
export const prayerSummary = (row: any) => ({
    id: row.id,
    /** Двести тридцать пять из тысячи подписаны просто «Моли́тва». */
    title: row.title ?? null,
    /** При ком она: при памяти, при акафисте, при каноне. */
    kind: row.kind ?? null,
    owner: row.owner ?? null,
    ownerId: row.ownerId ?? null,
    seq: row.seq ?? 1,
    incipit: row.incipit ?? null,
});

/** Молитва целиком. */
export const prayerDetail = (row: any, siblings: any[] = []) => ({
    ...prayerSummary(row),
    text: row.text ?? "",
    language: row.language ?? null,
    sourceBook: row.sourceBook ?? null,
    sourceUrl: row.sourceUrl ?? null,
    /**
     * Что напечатано здесь же — при том же акафисте или той же памяти. Только
     * подпись и порядок: род и владелец у них те же, что у этой, и повторять их
     * по разу на соседа незачем.
     */
    siblings: siblings.map((row: any) => ({
        id: row.id,
        title: row.title ?? null,
        seq: row.seq ?? 1,
    })),
});
