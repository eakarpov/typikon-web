import {isFootnoteBook} from "@/utils/texts";

export interface IFootnoteLink {
    value: string;
    footnotes: string[];
}

const FootnoteLink = ({ value, footnotes }: IFootnoteLink) => {
    const footnote = footnotes[parseInt(value, 10) - 1];
    const {
        isBook,
        book,
        probablePlace
    } = isFootnoteBook(footnote);
    return isBook ? (
        <a
            href={`https://azbyka.ru/biblia/?${book}.${probablePlace}&c`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-stone-900 cursor-pointer pl-1"
        >
            {footnote}
        </a>
    ) : (
        <a
            href={`#footnotes-${value}`}
            className="text-xs text-stone-500 cursor-pointer"
        >
            {value}
        </a>
    );
};

export default FootnoteLink;
