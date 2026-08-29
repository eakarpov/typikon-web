// Подписи к машинным ключам корпуса typikon-rules.
//
// Держим их здесь, а не в самом корпусе: там ключи — часть данных и должны
// оставаться устойчивыми (по ним написаны правила устава и собраны выборки),
// а как их назвать по-русски — вопрос показа, и меняться он может свободно.
//
// Ключа может не оказаться в таблице: книги вводятся помесячно, роды
// песнопений прибавляются по мере разбора. Поэтому labelOf возвращает сам
// ключ, а не пустоту — незнакомое лучше показать как есть, чем спрятать.

export const BOOK_LABELS: Record<string, string> = {
    "menaion": "Минея",
    "octoechos": "Октоих",
    "triod-postnaya": "Триодь постная",
    "triod-tsvetnaya": "Триодь цветная",
    "obshaya-mineya": "Минея общая",
};

export const SERVICE_LABELS: Record<string, string> = {
    "vespers": "вечерня",
    "matins": "утреня",
    "liturgy": "литургия",
    "hours": "часы",
    "compline": "повечерие",
    "midnight": "полунощница",
    "moleben": "молебен",
    "molitva": "молитва",
    // Две разные пустоты, и сводить их в одну подпись нельзя.
    // «unspecified» (667 групп) — книга службы не назвала: тропарь с кондаком
    // поются на любой, и устав решает, на какой именно.
    // «unassigned» (19) — обрывок, который разнести по службам не удалось
    // вовсе; это видно и должно оставаться видно.
    "unspecified": "служба не названа",
    "unassigned": "не разнесено",
};

export const UNIT_LABELS: Record<string, string> = {
    "stichera": "стихира",
    "sedalen": "седален",
    "troparion": "тропарь",
    "irmos": "ирмос",
    "kontakion": "кондак",
    "ikos": "икос",
    "svetilen": "светилен",
    "velichanie": "величание",
    "prokimen": "прокимен",
    "paremiya": "паремия",
    "apostol": "Апостол",
    "evangelie": "Евангелие",
    "ipakoi": "ипакои",
    "verse": "стих",
};

export const SIGN_LABELS: Record<string, string> = {
    // «velikiy» приходит только из Соборника Минеи общей: по строению
    // напечатанной службы великий праздник от бденного не отличить.
    "velikiy": "великий праздник",
    "bdenie": "бдение",
    "polieley": "полиелей",
    "slavoslovie": "славословие",
    "shesterichnaya": "шестеричная",
    "bez-znaka": "без знака",
    "alliluynaya": "аллилуйная",
    "povecherie": "повечерие",
};

export const MARKER_LABELS: Record<string, string> = {
    "bogorodicen": "богородичен",
    "krestobogorodicen": "крестобогородичен",
    "troicen": "троичен",
    "mucenicen": "мученичен",
    "zaupokoiny": "заупокойный",
    "prazdnika": "праздника",
};

export const PLACEMENT_LABELS: Record<string, string> = {
    "slava": "Слава",
    "i-nyne": "И ныне",
    "slava-i-nyne": "Слава, и ныне",
};

// Чем строка является в корпусе — по её владельцу в схеме. Не жанр и не
// книга: каноны тоже напечатаны в книгах, но живут своей таблицей, потому что
// адресуют их целиком, а не по месту службы.
export const SOURCE_LABELS: Record<string, string> = {
    "book": "книги",
    "canon": "каноны",
    "akathist": "акафисты",
    "prayer": "молитвы",
};

// При ком молитва напечатана. Именно владелец её и называет: двести тридцать
// пять книжных молитв из трёхсот подписаны просто «Моли́тва».
export const PRAYER_KIND_LABELS: Record<string, string> = {
    "memory": "при памяти",
    "akathist": "при акафисте",
    "canon": "при каноне",
};

// Роль канона в службе. Октоих объявляет её сам, и устав зовёт канон по
// имени, а не по порядку печати (Типикон, гл. 4).
export const CANON_ROLE_LABELS: Record<string, string> = {
    "voskresny": "воскресный",
    "krestovoskresny": "крестовоскресный",
    "bogorodichen": "Богородицы",
};

// Кому акафист. «Иконе» отдельно от «Богородице» намеренно: акафист пред
// иконой обращён к иконе, и свести их в одно значило бы соврать в одном из двух.
export const SUBJECT_KIND_LABELS: Record<string, string> = {
    "gospod": "Господу",
    "bogorodica": "Богородице",
    "ikona": "пред иконой",
    "prazdnik": "празднику",
    "svyatoy": "святому",
};

// Чем акафист является уставу. Различать обязательно: уставом положен ровно
// один — Великий; остальные к общественному богослужению не назначены и в
// сборку служб не идут.
export const AKATHIST_STATUS_LABELS: Record<string, string> = {
    "ustavny": "положен уставом",
    "odobrenny": "одобрен к употреблению",
    "chastny": "частное сочинение",
};

// Месяцы месяцеслова. Церковный год начинается сентябрём, но нумерация в
// корпусе обычная, январская, — поэтому и подписи здесь по номеру месяца.
//
// Форм две, и обе нужны: в списке фильтров месяц стоит сам по себе («май»),
// а рядом с числом — при нём («11 мая»). Одной формой не обойтись.
export const MONTH_LABELS = [
    "", "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

export const MONTH_OF = [
    "", "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export const labelOf = (table: Record<string, string>, key: string | null | undefined): string =>
    (key && table[key]) || key || "";

export const monthLabel = (month: number | null | undefined): string =>
    (month && MONTH_LABELS[month]) || "";

/**
 * Короткое имя места службы.
 *
 * В корпусе подпись позиции — это ещё и заметка о ней: «Канон — пул; по
 * умолчанию из Октоиха, иногда Триоди; устав решает службу…». Для правил это
 * полезно, а в строке выдачи такая подпись длиннее самого песнопения и топит
 * всё вокруг. Режем по тире или скобке — там, где кончается имя и начинается
 * пояснение. Таких подписей всего четыре из 56, остальные проходят как есть.
 *
 * Полную оставляем подсказкой при наведении: сокращать — не значит терять.
 */
export const shortPosition = (label: string | null | undefined): string => {
    if (!label) return "";
    const cut = label.split(" — ")[0].split(" (")[0].trim();
    return cut || label;
};

/**
 * Адрес строфы акафиста: «икос 4», «кондак 12», «проимий 1».
 *
 * Проимий подписываем родом, а не жанром: по форме он кондак, но кондаки
 * акафиста нумерованы своим счётом, и «кондак 1» рядом с «кондак 2» из
 * акростиха читалось бы как соседние строфы, тогда как это разные ряды.
 */
export const stanzaLabel = (
    unit: string | null | undefined,
    stanza: number | null | undefined,
    kind: string | null | undefined,
): string => {
    if (!stanza) return "";
    if (kind === "prooimion") return `проимий ${stanza}`;
    const name = labelOf(UNIT_LABELS, unit);
    return name ? `${name} ${stanza}` : "";
};

/**
 * Где в книге стоит память: «11 мая», «глас 1, воскресенье», «−15 от Пасхи».
 *
 * У каждой книги своя координата, и общей нет: Минея адресует числом
 * месяцеслова, Октоих — гласом и днём седмицы, Триоди — расстоянием от Пасхи,
 * Минея общая — разрядом святого. Поэтому не одно поле, а то из них, какое у
 * этой книги непусто (см. memories в схеме корпуса).
 */
export const memoryAddress = (m: {
    book?: string | null; month?: number | null; day?: number | null;
    paschaOffset?: number | null; weekday?: string | null; memoryTone?: number | null;
}): string => {
    const parts = [
        dayOfMonth(m.day, m.month) || null,
        m.memoryTone ? `глас ${m.memoryTone}` : null,
        m.weekday || null,
        // Отступ от Пасхи показываем со знаком: минус — постная часть Триоди,
        // плюс — цветная, и путать их нельзя.
        m.paschaOffset !== null && m.paschaOffset !== undefined
            ? `${m.paschaOffset > 0 ? "+" : ""}${m.paschaOffset} от Пасхи` : null,
    ].filter(Boolean);
    return parts.join(", ");
};

/** Число месяцеслова: «11 мая». Без месяца — пусто, а не голое число. */
export const dayOfMonth = (day: number | null | undefined, month: number | null | undefined): string =>
    month && MONTH_OF[month] ? `${day ?? ""} ${MONTH_OF[month]}`.trim() : "";
