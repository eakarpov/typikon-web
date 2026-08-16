import {Nullable} from "mongodb/src/mongo_types";
import {DayDTO} from "@/types/dto/days";

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

export enum TextContentType {
    PARAGRAPHS= "paragraphs",
    VERSES= "verses",
}

export const printTextContentType = (contentType: TextContentType) => {
    switch (contentType) {
        case TextContentType.VERSES:
            return "Стихи (Библия и т.п.)";
        case TextContentType.PARAGRAPHS:
        default:
            return "Абзацы";
    }
};

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

interface IBookMapEntry {
    code: string; // код книги в адресной схеме azbyka.ru (для ссылок на сноски)
    slug: string; // язык-независимый идентификатор книги для Библий/зачал (biblia-{lang}-{slug}-N)
}

const bookMap = {
    "Быт": { code: "Gen", slug: "bytie" },
    "Исх": { code: "Ex", slug: "iskhod" },
    "Лев": { code: "Lev", slug: "levit" },
    "Чис": { code: "Num", slug: "chisla" },
    "Втор": { code: "Deut", slug: "vtorozakonie" },
    "Нав": { code: "Nav", slug: "iisus-navin" },
    "Суд": { code: "Judg", slug: "sudi" },
    "Руф": { code: "Rth", slug: "ruf" },
    "1Цар": { code: "1Sam", slug: "1-tsarstv" },
    "2Цар": { code: "2Sam", slug: "2-tsarstv" },
    "3Цар": { code: "3Sam", slug: "3-tsarstv" },
    "4Цар": { code: "4Sam", slug: "4-tsarstv" },
    "1Пар": { code: "1Chron", slug: "1-paralipomenon" },
    "2Пар": { code: "2Chron", slug: "2-paralipomenon" },
    "1Езд": { code: "Ezr", slug: "1-ezdry" },
    "Неем": { code: "Nehem", slug: "neemii" },
    "2Езд": { code: "2Ezr", slug: "2-ezdry" },
    "Тов": { code: "Tov", slug: "tovita" },
    "Иудиф": { code: "Judf", slug: "iudifi" },
    "Есф": { code: "Est", slug: "esfir" },
    "Иов": { code: "Job", slug: "iova" },
    "Пс": { code: "Ps", slug: "psaltir" },
    "Прит": { code: "Prov", slug: "pritchi" },
    "Еккл": { code: "Eccl", slug: "ekklesiast" },
    "Песн": { code: "Song", slug: "pesn-pesney" },
    "Прем": { code: "Solom", slug: "premudrosti-solomona" },
    "Сир": { code: "Sir", slug: "sirakha" },
    "Ис": { code: "Is", slug: "isaii" },
    "Иер": { code: "Jer", slug: "ieremii" },
    "Плч": { code: "Lam", slug: "plach-ieremii" },
    "ПослИер": { code: "pJer", slug: "poslanie-ieremii" },
    "Вар": { code: "Bar", slug: "varukha" },
    "Иез": { code: "Ezek", slug: "iezekiilya" },
    "Дан": { code: "Dan", slug: "daniila" },
    "Ос": { code: "Hos", slug: "osii" },
    "Иоил": { code: "Joel", slug: "ioilya" },
    "Ам": { code: "Am", slug: "amosa" },
    "Авд": { code: "Avd", slug: "avdiya" },
    "Ион": { code: "Jona", slug: "iony" },
    "Мих": { code: "Mic", slug: "mikheya" },
    "Наум": { code: "Naum", slug: "nauma" },
    "Авв": { code: "Habak", slug: "avvakuma" },
    "Соф": { code: "Sofon", slug: "sofonii" },
    "Аг": { code: "Hag", slug: "aggeya" },
    "Зах": { code: "Zah", slug: "zakharii" },
    "Мал": { code: "Mal", slug: "malakhii" },
    "1Мак": { code: "1Mac", slug: "1-makkaveyskaya" },
    "2Мак": { code: "2Mac", slug: "2-makkaveyskaya" },
    "3Мак": { code: "3Mac", slug: "3-makkaveyskaya" },
    "3Езд": { code: "3Ezr", slug: "3-ezdry" },
    "Мф": { code: "Mt", slug: "matfeya" },
    "Мк": { code: "Mk", slug: "marka" },
    "Лк": { code: "Lk", slug: "luki" },
    "Ин": { code: "Jn", slug: "ioanna" },
    "Деян": { code: "Act", slug: "deyaniya" },
    "Иак": { code: "Jac", slug: "iakova" },
    "1Пет": { code: "1Pet", slug: "1-petra" },
    "2Пет": { code: "2Pet", slug: "2-petra" },
    "1Ин": { code: "1Jn", slug: "1-ioanna-posl" },
    "2Ин": { code: "2Jn", slug: "2-ioanna-posl" },
    "3Ин": { code: "3Jn", slug: "3-ioanna-posl" },
    "Иуд": { code: "Juda", slug: "iudy" },
    "Рим": { code: "Rom", slug: "rimlyanam" },
    "1Кор": { code: "1Cor", slug: "1-korinfyanam" },
    "2Кор": { code: "2Cor", slug: "2-korinfyanam" },
    "Гал": { code: "Gal", slug: "galatam" },
    "Еф": { code: "Eph", slug: "efesyanam" },
    "Флп": { code: "Phil", slug: "filippiytsam" },
    "Кол": { code: "Col", slug: "kolossyanam" },
    "1Фес": { code: "1Thes", slug: "1-fessaloniyitsam" },
    "2Фес": { code: "2Thes", slug: "2-fessaloniyitsam" },
    "1Тим": { code: "1Tim", slug: "1-timofeyu" },
    "2Тим": { code: "2Tim", slug: "2-timofeyu" },
    "Тит": { code: "Tit", slug: "titu" },
    "Флм": { code: "Phlm", slug: "filimonu" },
    "Евр": { code: "Hebr", slug: "evreyam" },
    "Откр": { code: "Apok", slug: "otkrovenie" },
} as { [key: string]: IBookMapEntry };

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
