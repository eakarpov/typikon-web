import {Nullable} from "mongodb/src/mongo_types";

export enum TextKind {
    TEACHIND= "Teaching",
    PRAISING= "Praising",
    HISTORIC= "Historic",
    INTERPRETATION= "Interpretation",
    CATECHISTIC= "Catechistic",
    SYNAXARION= "Synaxarion",
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
  }  
};

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
    APOLUTIKA_TROPARIA= "apolutikaTroparia",
    BEFORE_1h= "before1h",
    PANAGIA= "panagia",
    H1= "h1",
    H3= "h3",
    H6= "h6",
    H9= "h9",
}

export const footNotesToArray = (footNotesText: string): Nullable<string>[] =>
    footNotesText
        ? footNotesText.split("\n").map(footNotesRow => footNotesRow.split(" ")[1])
        : [];

export const fullTitle = (valueName: TextType, valueKind: TextKind, author: string, startString: string) => {
    const typeTitle = valueTitle(valueName);
    const kind = fullTextKind(valueKind, author);
    return `${typeTitle} ${kind}, егоже начало сице: ${startString}`;
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
          return "По третьей песне";
      case TextType.SONG_6:
          return "По шестой песне";
      case TextType.APOLUTIKA_TROPARIA:
          return "По отпустительным тропарям утрени";
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
  }
};

const bookMap = {
    "Быт": "Gen",
    "Исх": "Ex",
    "Лев": "Lev",
    "Чис": "Num",
    "Втор": "Deut",
    "Нав": "Nav",
    "Суд": "Judg",
    "Руф": "Rth",
    "1Цар": "1Sam",
    "2Цар": "2Sam",
    "3Цар": "3Sam",
    "4Цар": "4Sam",
    "1Пар": "1Chron",
    "2Пар": "2Chron",
    "1Езд": "Ezr",
    "Неем": "Nehem",
    "2Езд": "2Ezr",
    "Тов": "Tov",
    "Иудиф": "Judf",
    "Есф": "Est",
    "Иов": "Job",
    "Пс": "Ps",
    "Прит": "Prov",
    "Еккл": "Eccl",
    "Песн": "Song",
    "Прем": "Solom",
    "Сир": "Sir",
    "Ис": "Is",
    "Иер": "Jer",
    "Плч": "Lam",
    "ПослИер": "pJer",
    "Вар": "Bar",
    "Иез": "Ezek",
    "Дан": "Dan",
    "Ос": "Hos",
    "Иоил": "Joel",
    "Ам": "Am",
    "Авд": "Avd",
    "Ион": "Jona",
    "Мих": "Mic",
    "Наум": "Naum",
    "Авв": "Habak",
    "Соф": "Sofon",
    "Аг": "Hag",
    "Зах": "Zah",
    "Мал": "Mal",
    "1Мак": "1Mac",
    "2Мак": "2Mac",
    "3Мак": "3Mac",
    "3Езд": "3Ezr",
    "Мф": "Mt",
    "Мк": "Mk",
    "Лк": "Lk",
    "Ин": "Jn",
    "Деян": "Act",
    "Иак": "Jac",
    "1Пет": "1Pet",
    "2Пет": "2Pet",
    "1Ин": "1Jn",
    "2Ин": "2Jn",
    "3Ин": "3Jn",
    "Иуд": "Juda",
    "Рим": "Rom",
    "1Кор": "1Cor",
    "2Кор": "2Cor",
    "Гал": "Gal",
    "Еф": "Eph",
    "Флп": "Phil",
    "Кол": "Col",
    "1Фес": "1Thes",
    "2Фес": "2Thes",
    "1Тим": "1Tim",
    "2Тим": "2Tim",
    "Тит": "Tit",
    "Флм": "Phlm",
    "Евр": "Hebr",
    "Откр": "Apok",
} as { [key: string]: string };

export const isFootnoteBook = (value?: string) => {
    const [probableBook, probablePlace] = (value || "").split(".");
    const isBook = Object.keys(bookMap).includes(probableBook);
    return {
        isBook,
        probableBook,
        probablePlace,
        book: bookMap[probableBook],
    };
};
