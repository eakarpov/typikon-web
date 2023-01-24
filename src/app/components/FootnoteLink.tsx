export interface IFootnoteLink {
    value: string;
    footnotes: string[];
}

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

const FootnoteLink = ({ value, footnotes }: IFootnoteLink) => {
    const footnote = footnotes[parseInt(value, 10) - 1];
    const [probableBook, probablePlace] = footnote.split(".");
    const isBook = Object.keys(bookMap).includes(probableBook);
    return isBook ? (
        <a
            href={`https://azbyka.ru/biblia/?${bookMap[probableBook]}.${probablePlace}&c`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-stone-900 cursor-pointer pl-1"
        >
            {footnote}
        </a>
    ) : (
        <span className="text-xs text-stone-500 cursor-pointer">
            {value}
        </span>
    );
};

export default FootnoteLink;
