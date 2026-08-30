// Канон Библии — единственный список книг на весь проект.
//
// Зачем отдельный файл. Издания расходятся между собой: в Елизаветинской Библии
// Сусанна и Вил — это 13-я и 14-я главы Даниила, а в румынской 1688 года они
// изданы отдельными книгами; у 2 Ездры нет румынского соответствия вовсе. Поэтому
// «книга издания» и «книга канона» — разные вещи, и вторая должна быть одна,
// общая, чтобы зачало резолвилось в любое издание, а стихи сходились в параллель.
//
// ИДЕНТИФИКАТОР — ТОТ ЖЕ СЛУГ, что уже лежит в `pericopes.bookSlug` и в сносках.
// Это не совпадение, а условие: 1067 зачал и вся разметка сносок ссылаются на
// книги этими строками, и заведи мы «правильные» osis-коды — пришлось бы
// переписывать данные ради красоты идентификатора. Меняя id здесь, надо мигрировать
// pericopes.bookSlug тем же движением.
//
// Порядок и русские названия — из Елизаветинской Библии (славянская традиция:
// соборные послания перед посланиями ап. Павла, неканонические книги на своих
// местах). Аббревиатуры и коды azbyka.ru — из разметки сносок.
//
// Список закрыт: `texts.ts` выводит из него bookMap, а не наоборот.

export type BibleSection =
    | "pentateuch"
    | "historical"
    | "teaching"
    | "prophetic"
    | "lateHistorical"
    | "gospel"
    | "apostle"
    | "revelation";

export const BIBLE_SECTIONS: Array<{ id: BibleSection; label: string }> = [
    { id: "pentateuch", label: "Пятикнижие" },
    { id: "historical", label: "Исторические книги" },
    { id: "teaching", label: "Учительные книги" },
    { id: "prophetic", label: "Пророческие книги" },
    // Маккавейские и обе поздние Ездры стоят в славянской Библии между пророками
    // и Новым Заветом. Раздел заведён ради этого места, а не ради жанра: без него
    // разделы перестали бы быть сплошными отрезками канонического порядка.
    { id: "lateHistorical", label: "Маккавейские книги и Ездры" },
    { id: "gospel", label: "Евангелие" },
    { id: "apostle", label: "Апостол" },
    { id: "revelation", label: "Откровение" },
];

interface CanonEntry {
    /** Канонический идентификатор; он же pericopes.bookSlug. */
    id: string;
    /** Сокращение из разметки сносок и зачал: «Быт», «1Кор». */
    abbr: string;
    /** Код книги в адресной схеме azbyka.ru — для ссылок на сноски. */
    azbyka: string;
    /** Русское название, как в Елизаветинской Библии. */
    name: string;
}

// Порядок записей ЗНАЧИМ: из него берётся `order`, а разделы ниже размечены
// границами по этому же порядку.
const CANON_ORDER: CanonEntry[] = [
    { id: "bytie",                abbr: "Быт",     azbyka: "Gen",    name: "Бытие" },
    { id: "iskhod",               abbr: "Исх",     azbyka: "Ex",     name: "Исход" },
    { id: "levit",                abbr: "Лев",     azbyka: "Lev",    name: "Левит" },
    { id: "chisla",               abbr: "Чис",     azbyka: "Num",    name: "Числа" },
    { id: "vtorozakonie",         abbr: "Втор",    azbyka: "Deut",   name: "Второзаконие" },
    { id: "iisus-navin",          abbr: "Нав",     azbyka: "Nav",    name: "Книга Иисуса Навина" },
    { id: "sudi",                 abbr: "Суд",     azbyka: "Judg",   name: "Книга Судей" },
    { id: "ruf",                  abbr: "Руф",     azbyka: "Rth",    name: "Руфь" },
    { id: "1-tsarstv",            abbr: "1Цар",    azbyka: "1Sam",   name: "1-я Царств" },
    { id: "2-tsarstv",            abbr: "2Цар",    azbyka: "2Sam",   name: "2-я Царств" },
    { id: "3-tsarstv",            abbr: "3Цар",    azbyka: "3Sam",   name: "3-я Царств" },
    { id: "4-tsarstv",            abbr: "4Цар",    azbyka: "4Sam",   name: "4-я Царств" },
    { id: "1-paralipomenon",      abbr: "1Пар",    azbyka: "1Chron", name: "1-я Паралипоменон" },
    { id: "2-paralipomenon",      abbr: "2Пар",    azbyka: "2Chron", name: "2-я Паралипоменон" },
    { id: "1-ezdry",              abbr: "1Езд",    azbyka: "Ezr",    name: "1-я Ездры" },
    { id: "neemii",               abbr: "Неем",    azbyka: "Nehem",  name: "Неемии" },
    { id: "tovita",               abbr: "Тов",     azbyka: "Tov",    name: "Товита" },
    { id: "iudifi",               abbr: "Иудиф",   azbyka: "Judf",   name: "Иудифи" },
    { id: "esfir",                abbr: "Есф",     azbyka: "Est",    name: "Есфирь" },
    { id: "iova",                 abbr: "Иов",     azbyka: "Job",    name: "Иова" },
    { id: "psaltir",              abbr: "Пс",      azbyka: "Ps",     name: "Псалтирь" },
    { id: "pritchi",              abbr: "Прит",    azbyka: "Prov",   name: "Притчи Соломона" },
    { id: "ekklesiast",           abbr: "Еккл",    azbyka: "Eccl",   name: "Екклесиаст" },
    { id: "pesn-pesney",          abbr: "Песн",    azbyka: "Song",   name: "Песнь Песней" },
    { id: "premudrosti-solomona", abbr: "Прем",    azbyka: "Solom",  name: "Премудрости Соломона" },
    { id: "sirakha",              abbr: "Сир",     azbyka: "Sir",    name: "Премудрости Иисуса, сына Сирахова" },
    { id: "isaii",                abbr: "Ис",      azbyka: "Is",     name: "Исаии" },
    { id: "ieremii",              abbr: "Иер",     azbyka: "Jer",    name: "Иеремии" },
    { id: "plach-ieremii",        abbr: "Плч",     azbyka: "Lam",    name: "Плач Иеремии" },
    { id: "poslanie-ieremii",     abbr: "ПослИер", azbyka: "pJer",   name: "Послание Иеремии" },
    { id: "varukha",              abbr: "Вар",     azbyka: "Bar",    name: "Варуха" },
    { id: "iezekiilya",           abbr: "Иез",     azbyka: "Ezek",   name: "Иезекииля" },
    { id: "daniila",              abbr: "Дан",     azbyka: "Dan",    name: "Даниила" },
    { id: "osii",                 abbr: "Ос",      azbyka: "Hos",    name: "Осии" },
    { id: "ioilya",               abbr: "Иоил",    azbyka: "Joel",   name: "Иоиля" },
    { id: "amosa",                abbr: "Ам",      azbyka: "Am",     name: "Амоса" },
    { id: "avdiya",               abbr: "Авд",     azbyka: "Avd",    name: "Авдия" },
    { id: "iony",                 abbr: "Ион",     azbyka: "Jona",   name: "Ионы" },
    { id: "mikheya",              abbr: "Мих",     azbyka: "Mic",    name: "Михея" },
    { id: "nauma",                abbr: "Наум",    azbyka: "Naum",   name: "Наума" },
    { id: "avvakuma",             abbr: "Авв",     azbyka: "Habak",  name: "Аввакума" },
    { id: "sofonii",              abbr: "Соф",     azbyka: "Sofon",  name: "Софонии" },
    { id: "aggeya",               abbr: "Аг",      azbyka: "Hag",    name: "Аггея" },
    { id: "zakharii",             abbr: "Зах",     azbyka: "Zah",    name: "Захарии" },
    { id: "malakhii",             abbr: "Мал",     azbyka: "Mal",    name: "Малахии" },
    { id: "1-makkaveyskaya",      abbr: "1Мак",    azbyka: "1Mac",   name: "1-я Маккавейская" },
    { id: "2-makkaveyskaya",      abbr: "2Мак",    azbyka: "2Mac",   name: "2-я Маккавейская" },
    { id: "3-makkaveyskaya",      abbr: "3Мак",    azbyka: "3Mac",   name: "3-я Маккавейская" },
    { id: "2-ezdry",              abbr: "2Езд",    azbyka: "2Ezr",   name: "2-я Ездры" },
    { id: "3-ezdry",              abbr: "3Езд",    azbyka: "3Ezr",   name: "3-я Ездры" },
    { id: "matfeya",              abbr: "Мф",      azbyka: "Mt",     name: "От Матфея" },
    { id: "marka",                abbr: "Мк",      azbyka: "Mk",     name: "От Марка" },
    { id: "luki",                 abbr: "Лк",      azbyka: "Lk",     name: "От Луки" },
    { id: "ioanna",               abbr: "Ин",      azbyka: "Jn",     name: "От Иоанна" },
    { id: "deyaniya",             abbr: "Деян",    azbyka: "Act",    name: "Деяния апостолов" },
    { id: "iakova",               abbr: "Иак",     azbyka: "Jac",    name: "Иакова" },
    { id: "1-petra",              abbr: "1Пет",    azbyka: "1Pet",   name: "1-е Петра" },
    { id: "2-petra",              abbr: "2Пет",    azbyka: "2Pet",   name: "2-е Петра" },
    { id: "1-ioanna-posl",        abbr: "1Ин",     azbyka: "1Jn",    name: "1-е Иоанна" },
    { id: "2-ioanna-posl",        abbr: "2Ин",     azbyka: "2Jn",    name: "2-е Иоанна" },
    { id: "3-ioanna-posl",        abbr: "3Ин",     azbyka: "3Jn",    name: "3-е Иоанна" },
    { id: "iudy",                 abbr: "Иуд",     azbyka: "Juda",   name: "Иуды" },
    { id: "rimlyanam",            abbr: "Рим",     azbyka: "Rom",    name: "К Римлянам" },
    { id: "1-korinfyanam",        abbr: "1Кор",    azbyka: "1Cor",   name: "1-е Коринфянам" },
    { id: "2-korinfyanam",        abbr: "2Кор",    azbyka: "2Cor",   name: "2-е Коринфянам" },
    { id: "galatam",              abbr: "Гал",     azbyka: "Gal",    name: "К Галатам" },
    { id: "efesyanam",            abbr: "Еф",      azbyka: "Eph",    name: "К Ефесянам" },
    { id: "filippiytsam",         abbr: "Флп",     azbyka: "Phil",   name: "К Филиппийцам" },
    { id: "kolossyanam",          abbr: "Кол",     azbyka: "Col",    name: "К Колоссянам" },
    { id: "1-fessaloniyitsam",    abbr: "1Фес",    azbyka: "1Thes",  name: "1-е Фессалоникийцам" },
    { id: "2-fessaloniyitsam",    abbr: "2Фес",    azbyka: "2Thes",  name: "2-е Фессалоникийцам" },
    { id: "1-timofeyu",           abbr: "1Тим",    azbyka: "1Tim",   name: "1-е Тимофею" },
    { id: "2-timofeyu",           abbr: "2Тим",    azbyka: "2Tim",   name: "2-е Тимофею" },
    { id: "titu",                 abbr: "Тит",     azbyka: "Tit",    name: "К Титу" },
    { id: "filimonu",             abbr: "Флм",     azbyka: "Phlm",   name: "К Филимону" },
    { id: "evreyam",              abbr: "Евр",     azbyka: "Hebr",   name: "К Евреям" },
    { id: "otkrovenie",           abbr: "Откр",    azbyka: "Apok",   name: "Откровение" },
];

// Раздел задаётся первой своей книгой: так его нельзя проставить книге вразнобой,
// и разделы остаются сплошными отрезками канонического порядка (это проверяется
// тестом). Порядок пар должен совпадать с порядком BIBLE_SECTIONS.
const SECTION_STARTS: Array<[string, BibleSection]> = [
    ["bytie", "pentateuch"],
    ["iisus-navin", "historical"],
    ["iova", "teaching"],
    ["isaii", "prophetic"],
    ["1-makkaveyskaya", "lateHistorical"],
    ["matfeya", "gospel"],
    ["deyaniya", "apostle"],
    ["otkrovenie", "revelation"],
];

export interface BibleCanonBook extends CanonEntry {
    section: BibleSection;
    /** Место в каноническом порядке, начиная с 1. */
    order: number;
}

const buildCanon = (): BibleCanonBook[] => {
    const starts = new Map(SECTION_STARTS);
    let section: BibleSection | null = null;

    return CANON_ORDER.map((entry, index) => {
        section = starts.get(entry.id) ?? section;
        if (!section) {
            throw new Error(`Книга ${entry.id} стоит до первого раздела канона`);
        }
        return { ...entry, section, order: index + 1 };
    });
};

export const BIBLE_CANON: BibleCanonBook[] = buildCanon();

const BY_ID = new Map(BIBLE_CANON.map((book) => [book.id, book]));
const BY_ABBR = new Map(BIBLE_CANON.map((book) => [book.abbr, book]));
const BY_AZBYKA = new Map(BIBLE_CANON.map((book) => [book.azbyka, book]));

export const canonBook = (id: string | null | undefined): BibleCanonBook | null =>
    BY_ID.get(id || "") ?? null;

export const isCanonBook = (id: string | null | undefined): boolean => BY_ID.has(id || "");

/** Книга по сокращению из сносок и внешних источников: «Мф.», «1 Кор.». */
export const canonBookByAbbr = (abbr: string): BibleCanonBook | null =>
    BY_ABBR.get(abbr.replace(/\s+/g, "").replace(/\.$/, "")) ?? null;

/** Книга по коду azbyka.ru («Mt», «1Cor») — тот же код, что в data-title у зачал. */
export const canonBookByAzbyka = (code: string): BibleCanonBook | null =>
    BY_AZBYKA.get(code) ?? null;

/** Канон, разложенный по разделам в порядке BIBLE_SECTIONS, — для оглавления. */
export const canonBySection = (): Array<{ id: BibleSection; label: string; books: BibleCanonBook[] }> =>
    BIBLE_SECTIONS.map((section) => ({
        ...section,
        books: BIBLE_CANON.filter((book) => book.section === section.id),
    }));

/** Название книги для показа; незнакомый идентификатор отдаём как есть, а не прячем. */
export const canonBookName = (id: string | null | undefined): string =>
    BY_ID.get(id || "")?.name || id || "";
