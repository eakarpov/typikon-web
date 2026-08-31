// Поместные Церкви и уставы, по которым они служат.
//
// ЗАЧЕМ ЭТО ХРАМУ. Устав у Церквей разный: русская синодальная традиция и
// греческий Типикон Виолакиса расходятся и в знаках, и в самом строе службы, и
// собирать по русскому уставу службу афинского прихода — значит выдать ему
// чужое. Пока написан ОДИН устав (`jerusalem/rus-synodal`), и потому важнее
// не «выбрать верный», а честно сказать, где мы его не знаем.
//
// ЮРИСДИКЦИЯ НЕ ВЫВОДИТСЯ ИЗ СТРАНЫ, но связана с ней. В Греции почти всё —
// Элладская Церковь, а в Германии рядом стоят приходы РПЦ, Константинополя,
// Сербской и Румынской. Поэтому страна идёт умолчанием, а не выводом, и всякая
// выведенная юрисдикция помечается как выведенная (см. churchSource у храма).

export interface Jurisdiction {
    /** Устойчивый ключ. */
    key: string;
    /** Как называется по-русски. */
    label: string;
    /**
     * Устав движка (rite/tradition) — или null, когда его у нас нет.
     * Пустота здесь честнее подстановки русского устава: чужую службу лучше
     * не собрать вовсе, чем собрать неверно.
     */
    ustav: string | null;
}

export const JURISDICTIONS: Record<string, Jurisdiction> = {
    "rus": { key: "rus", label: "Русская Православная Церковь", ustav: "jerusalem/rus-synodal" },
    "ukr": { key: "ukr", label: "Православная Церковь Украины / УПЦ", ustav: "jerusalem/rus-synodal" },
    "blr": { key: "blr", label: "Белорусский экзархат", ustav: "jerusalem/rus-synodal" },
    "srb": { key: "srb", label: "Сербская Православная Церковь", ustav: null },
    "bgr": { key: "bgr", label: "Болгарская Православная Церковь", ustav: null },
    "rou": { key: "rou", label: "Румынская Православная Церковь", ustav: null },
    "grc": { key: "grc", label: "Элладская Православная Церковь", ustav: null },
    "cyp": { key: "cyp", label: "Кипрская Православная Церковь", ustav: null },
    "geo": { key: "geo", label: "Грузинская Православная Церковь", ustav: null },
    "mkd": { key: "mkd", label: "Македонская Православная Церковь", ustav: null },
    "alb": { key: "alb", label: "Албанская Православная Церковь", ustav: null },
    "pol": { key: "pol", label: "Польская Православная Церковь", ustav: null },
    "cze": { key: "cze", label: "Православная Церковь Чешских земель и Словакии", ustav: null },
    "fin": { key: "fin", label: "Финляндская Православная Церковь", ustav: null },
    "cop": { key: "cop", label: "Коптская Церковь", ustav: null },
    "eth": { key: "eth", label: "Эфиопская Церковь", ustav: null },
    "arm": { key: "arm", label: "Армянская Апостольская Церковь", ustav: null },
    "syr": { key: "syr", label: "Сирийская Церковь", ustav: null },
};

/**
 * Юрисдикция по метке исповедания OSM. Это САМОЕ НАДЁЖНОЕ, что есть: тег
 * ставит человек, глядя на храм, а не выводит машина по стране.
 */
export const BY_DENOMINATION: Record<string, string> = {
    russian_orthodox: "rus",
    ukrainian_orthodox: "ukr",
    belarusian_orthodox: "blr",
    serbian_orthodox: "srb",
    bulgarian_orthodox: "bgr",
    romanian_orthodox: "rou",
    greek_orthodox: "grc",
    georgian_orthodox: "geo",
    macedonian_orthodox: "mkd",
    coptic_orthodox: "cop",
    ethiopian_orthodox: "eth",
    armenian_apostolic: "arm",
    syriac_orthodox: "syr",
};

/**
 * Юрисдикция по стране — умолчание для тех, у кого исповедание помечено просто
 * «orthodox». В своей стране это почти всегда верно и почти всегда неверно в
 * диаспоре, потому и помечается выведенным.
 */
export const BY_COUNTRY: Record<string, string> = {
    RU: "rus", UA: "ukr", BY: "blr", MD: "rou", KZ: "rus", KG: "rus", UZ: "rus", AM: "arm",
    RS: "srb", ME: "srb", BA: "srb", HR: "srb", SI: "srb",
    BG: "bgr", RO: "rou", GR: "grc", CY: "cyp", GE: "geo", MK: "mkd", AL: "alb",
    PL: "pol", CZ: "cze", SK: "cze", FI: "fin", EE: "rus", LV: "rus", LT: "rus",
    EG: "cop", ET: "eth", ER: "eth",
};

export interface ResolvedChurch {
    church: string | null;
    /** «denomination» — сказано в источнике; «country» — выведено по стране. */
    churchSource: "denomination" | "country" | null;
    ustav: string | null;
}

export const resolveChurch = (denomination?: string | null, country?: string | null): ResolvedChurch => {
    const byTag = denomination ? BY_DENOMINATION[denomination] : undefined;
    if (byTag) return { church: byTag, churchSource: "denomination", ustav: JURISDICTIONS[byTag]?.ustav ?? null };

    const byCountry = country ? BY_COUNTRY[country] : undefined;
    if (byCountry) return { church: byCountry, churchSource: "country", ustav: JURISDICTIONS[byCountry]?.ustav ?? null };

    return { church: null, churchSource: null, ustav: null };
};

/**
 * Названия стран по-русски. Только те, где православные храмы есть в заметном
 * числе, — остальные показываются кодом: выдумывать перевод ради одной записи
 * незачем, а код всегда честен.
 */
export const COUNTRY_LABELS: Record<string, string> = {
    RU: "Россия", UA: "Украина", BY: "Беларусь", MD: "Молдавия", KZ: "Казахстан",
    GE: "Грузия", AM: "Армения", AZ: "Азербайджан", KG: "Киргизия", UZ: "Узбекистан",
    GR: "Греция", CY: "Кипр", BG: "Болгария", RO: "Румыния", RS: "Сербия",
    ME: "Черногория", MK: "Северная Македония", BA: "Босния и Герцеговина",
    HR: "Хорватия", SI: "Словения", AL: "Албания", XK: "Косово",
    PL: "Польша", CZ: "Чехия", SK: "Словакия", HU: "Венгрия", LT: "Литва",
    LV: "Латвия", EE: "Эстония", FI: "Финляндия", SE: "Швеция", NO: "Норвегия",
    DE: "Германия", FR: "Франция", IT: "Италия", ES: "Испания", GB: "Великобритания",
    AT: "Австрия", CH: "Швейцария", BE: "Бельгия", NL: "Нидерланды",
    US: "США", CA: "Канада", AU: "Австралия", NZ: "Новая Зеландия",
    IL: "Израиль", PS: "Палестина", TR: "Турция", SY: "Сирия", LB: "Ливан",
    EG: "Египет", ET: "Эфиопия", ER: "Эритрея", SD: "Судан",
    AR: "Аргентина", BR: "Бразилия", CL: "Чили", MX: "Мексика",
};

export const countryLabel = (code?: string | null): string | null =>
    code ? COUNTRY_LABELS[code] ?? code : null;

/**
 * Где имеет смысл отсылать к русским сводам храмов. Соборы.ру и «Храмы России»
 * описывают Россию и ближнее зарубежье; предлагать их албанскому собору —
 * значит послать читателя в пустоту.
 */
export const RUSSIAN_CATALOGUE_COUNTRIES = new Set(["RU", "UA", "BY", "MD", "KZ", "KG", "UZ", "AM", "GE", "LV", "LT", "EE"]);
