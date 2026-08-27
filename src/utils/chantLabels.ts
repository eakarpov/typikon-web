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

/** Число месяцеслова: «11 мая». Без месяца — пусто, а не голое число. */
export const dayOfMonth = (day: number | null | undefined, month: number | null | undefined): string =>
    month && MONTH_OF[month] ? `${day ?? ""} ${MONTH_OF[month]}`.trim() : "";
