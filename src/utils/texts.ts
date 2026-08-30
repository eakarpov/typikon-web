// Свой Nullable вместо импорта из mongodb/src/mongo_types: тот импорт лез прямо
// в ИСХОДНИКИ драйвера (не в .d.ts), и tsc начинал проверять весь его src —
// больше сотни чужих ошибок в отчёте, из-за которых проверку типов нельзя было
// включить в CI.
type Nullable<T> = T | null;
import {DayDTO} from "@/types/dto/days";
import {BIBLE_CANON} from "@/utils/bibleCanon";

export enum TextReadiness {
    READY= "ready",
    CORRECTION= "correcting",
    TEXTING= "texted",
    PRESENCE= "presence",
    ABSENCE= "absence",
}

export const printTextReadiness = (readiness: TextReadiness) => {
    switch (readiness) {
        case TextReadiness.READY:
            return "Готово";
        case TextReadiness.CORRECTION:
            return "Коррекция";
        case TextReadiness.TEXTING:
            return "Отекстовано";
        case TextReadiness.PRESENCE:
            return "В наличии";
        case TextReadiness.ABSENCE:
            return "Пока отсутствует";
        default:
            return "Информация о готовности не добавлена";
    }
}

export const textReadinessClassname = (readiness: TextReadiness) => {
    switch (readiness) {
        case TextReadiness.READY:
            return "bg-green-500 text-white";
        case TextReadiness.CORRECTION:
            return "blue";
        case TextReadiness.TEXTING:
            return "yellow";
        case TextReadiness.PRESENCE:
            return "grey";
        case TextReadiness.ABSENCE:
            return "black";
    }
}

// Стихами набрана только Библия, а она с некоторых пор живёт своей моделью
// (@/lib/bible/schema) — поэтому у текста собрания остался один вид содержимого.
// Тип оставлен, а не выброшен: он записан в трёх тысячах документов, и снимать
// его оттуда ради одного значения — работа без выгоды.
export enum TextContentType {
    PARAGRAPHS= "paragraphs",
}

export const printTextContentType = (_contentType: TextContentType) => "Абзацы";

export enum TextKind {
    TEACHIND= "Teaching",
    PRAISING= "Praising",
    HISTORIC= "Historic",
    INTERPRETATION= "Interpretation",
    CATECHISTIC= "Catechistic",
    SYNAXARION= "Synaxarion",
    SERVICE= "Service",
    PRAYER= "Prayer",
}

export enum DneslovKind {
    MEMORY= "MEMORY",
    // EVENT= "EVENT",
    AUTHOR= "AUTHOR",
}

export const printTextKind = (kind: TextKind) => {
  switch (kind) {
      case TextKind.HISTORIC:
          return "Житийное";
      case TextKind.INTERPRETATION:
          return "Толкование";
      case TextKind.PRAISING:
          return "Похвальное";
      case TextKind.TEACHIND:
          return "Учительное";
      case TextKind.CATECHISTIC:
          return "Огласительное";
      case TextKind.SYNAXARION:
          return "Синаксарь";
      case TextKind.SERVICE:
          return "Последование";
      case TextKind.PRAYER:
          return "Молитва";
  }  
};

export const printDneslovKind = (kind: DneslovKind) => {
    switch (kind) {
        // case DneslovKind.EVENT:
        //     return "Событие";
        case DneslovKind.MEMORY:
            return "Память";
        case DneslovKind.AUTHOR:
            return "Автор";
        default:
            return "";
    }
}

export const fullTextKind = (kind: TextKind, author: string) => {
    switch (kind) {
        case TextKind.HISTORIC:
            return `слово житийное (${author})`;
        case TextKind.INTERPRETATION:
            return `толкование ${author}`;
        case TextKind.PRAISING:
            return `слово похвальное ${author}`;
        case TextKind.TEACHIND:
            return `слово учительное ${author}`;
        case TextKind.CATECHISTIC:
            return `слово огласительное ${author}`;
        case TextKind.SYNAXARION:
            return "синаксарь";
    }
};

export enum TextType {
    VESPERS_PROKIMENON= "vespersProkimenon",
    VIGIL= "vigil",
    KATHISMA_1= "kathisma1",
    KATHISMA_2= "kathisma2",
    KATHISMA_3= "kathisma3",
    IPAKOI= "ipakoi",
    POLYELEOS= "polyeleos",
    SONG_3= "song3",
    SONG_6= "song6",
    BEFORE_1h= "before1h",
    PANAGIA= "panagia",
    H1= "h1",
    H3= "h3",
    H6= "h6",
    H9= "h9",

    // Отпустительные тропари утрени — Пасха, Великая суббота, в т.ч. после входа
    // на Великом славословии (не только Пасха, несмотря на название поля).
    APOLUTIKA_TROPARIA= "apolutikaTroparia",
    BEFORE_50= "before50",

    APOSTLE_LITURGY= "apostleLiturgy",
    GOSPEL_LITURGY= "gospelLiturgy",
    GOSPEL_MATINS= "gospelMatins",
}

export const footNotesToArray = (footNotesText: string): Nullable<string>[] =>
    footNotesText
        ? footNotesText.split("\n").map(footNotesRow => footNotesRow.substring(footNotesRow.indexOf(' ') + 1))
        : [];

export const fullTitle = (valueKind: TextKind, author: string, startString: string) => {
    const kind = fullTextKind(valueKind, author);
    switch (valueKind) {
        case TextKind.TEACHIND:
        case TextKind.PRAISING:
        case TextKind.INTERPRETATION:
            return `${kind}, егоже начало сице: ${startString}`;
        case TextKind.SYNAXARION:
            return `${kind}, егоже начало сице: ${startString}`;
        case TextKind.HISTORIC:
            return "Пролог";
        case TextKind.CATECHISTIC:
            return kind;
        default:
            return "";
    }
}

// Порядок слотов службы — не порядок объявления в TextType, а порядок следования
// богослужения (Евангелие на утрене читается до Литургии). Единый список для всего:
// страницы дня, оглавления и публичного API, чтобы они не разъезжались.
export const DAY_SLOT_ORDER: TextType[] = [
    TextType.VESPERS_PROKIMENON,
    TextType.VIGIL,
    TextType.KATHISMA_1,
    TextType.KATHISMA_2,
    TextType.KATHISMA_3,
    TextType.IPAKOI,
    TextType.POLYELEOS,
    TextType.GOSPEL_MATINS,
    TextType.SONG_3,
    TextType.SONG_6,
    TextType.APOLUTIKA_TROPARIA,
    TextType.BEFORE_1h,
    TextType.H3,
    TextType.H6,
    TextType.H9,
    TextType.PANAGIA,
    TextType.APOSTLE_LITURGY,
    TextType.GOSPEL_LITURGY,
];

export const valueTitle = (valueName: TextType) => {
  switch (valueName) {
      case TextType.VESPERS_PROKIMENON:
          return "На паремиях вечерни по прокимне";
      case TextType.VIGIL:
          return "На всенощном бдении перед шестопсалмием";
      case TextType.KATHISMA_1:
          return "По первой кафизме";
      case TextType.KATHISMA_2:
          return "По второй кафизме";
      case TextType.KATHISMA_3:
          return "По третьей кафизме";
      case TextType.IPAKOI:
          return "По ипакои";
      case TextType.POLYELEOS:
          return "По полиелее";
      case TextType.SONG_3:
          return "По третьей песни";
      case TextType.SONG_6:
          return "По шестой песни";
      case TextType.BEFORE_1h:
          return "Перед первым часом";
      case TextType.H1:
          return "На первом часе";
      case TextType.H3:
          return "На третьем часе";
      case TextType.H6:
          return "На шестом часе";
      case TextType.H9:
          return "На девятом часе";
      case TextType.PANAGIA:
          return "На панагии";

      case TextType.APOLUTIKA_TROPARIA:
          return "По отпустительным тропарям утрени"; // Пасха, Великая суббота и т.п.
      case TextType.BEFORE_50:
          return "Перед 50 псалмом"; // Только Великий пяток, т.к. нет кафизм
      case TextType.APOSTLE_LITURGY:
          return "Апостол на Литургии";
      case TextType.GOSPEL_LITURGY:
          return "Евангелие на Литургии";
      case TextType.GOSPEL_MATINS:
          return "Евангелие на утрени";
  }
};

// Книги Библии для сносок и зачал — вид канона, а не второй его список.
// Раньше здесь лежали те же 77 книг литералом; с появлением второго издания
// стало ясно, что список должен быть один на проект, и он переехал в
// @/utils/bibleCanon. Здесь остались только функции разбора, которыми пользуется
// разметка сносок («Быт.1:1») и импорт зачал с azbyka.ru.
interface IBookMapEntry {
    code: string; // код книги в адресной схеме azbyka.ru (для ссылок на сноски)
    slug: string; // язык-независимый идентификатор книги для Библий/зачал (biblia-{lang}-{slug}-N)
}

const bookMap = Object.fromEntries(
    BIBLE_CANON.map((book) => [book.abbr, { code: book.azbyka, slug: book.id }]),
) as { [key: string]: IBookMapEntry };

export const isFootnoteBook = (value?: string) => {
    const [probableBook, probablePlace] = (value || "").split(".");
    const isBook = Object.keys(bookMap).includes(probableBook);
    return {
        isBook,
        probableBook,
        probablePlace,
        book: bookMap[probableBook]?.code,
        bookSlug: bookMap[probableBook]?.slug,
    };
};

// Ищет книгу по сокращению из внешних источников (например, "Мф." или "1 Кор." со
// страниц зачал azbyka.ru) — не завязано на формат "Книга.Место", просто нормализует
// пробелы/точку и ищет точное совпадение с ключом bookMap.
export const findBookSlugByAbbreviation = (abbreviation: string): string | null => {
    const normalized = abbreviation.replace(/\s+/g, "").replace(/\.$/, "");
    return bookMap[normalized]?.slug ?? null;
};

// Обратный поиск по коду azbyka.ru (например, "Mt", "Act", "1Cor" — тот же код,
// что используется в data-title у зачал) — возвращает наш slug и короткую русскую
// аббревиатуру книги (без точки).
export const findBookByCode = (code: string): { slug: string; abbreviation: string } | null => {
    const entry = Object.entries(bookMap).find(([, v]) => v.code === code);
    return entry ? { slug: entry[1].slug, abbreviation: entry[0] } : null;
};

// Список канонических книг для выбора в админке (редактор текста, поле "каноническая
// книга Библии для зачал"). Поле остаётся свободным текстовым вводом — не все книги
// изданий Библии есть в bookMap (например, отдельно изданные "Песнь трёх отроков"
// в румынской Библии), поэтому это только подсказки, а не жёсткий enum.
export const BIBLE_BOOK_SLUG_OPTIONS = Object.entries(bookMap)
    .map(([abbreviation, { slug }]) => ({ slug, label: `${abbreviation} — ${slug}` }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

// Граница абзаца — ровно два перевода строки. В части импортированных текстов между
// ними затесался пробельный символ («\n \n», а иногда неразрывный пробел U+00A0,
// табуляция или U+2003), и такой абзац не распознаётся ни вебом (ReadingContent,
// data-paragraph-index), ни мобильным приложением (text_page.dart, split("\n\n")) —
// весь текст становится одним огромным «абзацем».
//
// Чиним в самих данных, а не в двух местах разбора на разных платформах.
export const normalizeParagraphs = (content?: string | null): string =>
    typeof content === "string" ? content.replace(/\n[^\S\n]+\n/g, "\n\n") : "";
