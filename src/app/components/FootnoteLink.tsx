import {isFootnoteBook} from "@/utils/texts";

export interface IFootnoteLink {
    value: string;
    footnotes: string[];
}

const FootnoteLink = ({ value, footnotes }: IFootnoteLink) => {
    const [letter, ...rest] = value.split("");
    const note = rest.join("");
    const footnote = footnotes[parseInt(note, 10) - 1];
    const {
        isBook,
        book,
        probablePlace
    } = isFootnoteBook(footnote);
    return isBook ? (
        <span>
            {letter}
            <a
                href={`https://azbyka.ru/biblia/?${book}.${probablePlace}&c`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-stone-900 cursor-pointer pl-1"
            >
                {footnote}
            </a>
        </span>
    ) : (
        <span>
            {letter}
            <a
                href={`#footnotes-${note}`}
                className="text-xs text-stone-500 cursor-pointer"
            >
                {note}
            </a>
        </span>
    );
};

export default FootnoteLink;
