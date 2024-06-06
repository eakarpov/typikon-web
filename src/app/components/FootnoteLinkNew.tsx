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
        <span>
            <a
                href={`https://azbyka.ru/biblia/?${book}.${probablePlace}&c`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-red-900 cursor-pointer pl-1"
            >
                {footnote}
            </a>
        </span>
    ) : (
        <span>
            <a
                href={`#footnotes-${value}`}
                className="text-xs text-red-900 cursor-pointer"
            >
                [{value}]
            </a>
        </span>
    );
};

export default FootnoteLink;
