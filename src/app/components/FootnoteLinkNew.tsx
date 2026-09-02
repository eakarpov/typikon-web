import Link from "next/link";
import { isFootnoteBook } from "@/utils/texts";
import { footnoteHref } from "@/lib/bible/footnoteRef";

export interface IFootnoteLink {
    value: string;
    footnotes: string[];
}

/**
 * Сноска в тексте чтения. Библейская ведёт на стих, прочая — вниз, к перечню.
 *
 * Библейская ссылка раньше уходила на azbyka.ru: своей Библии у сайта не
 * было. Теперь есть, и уводить читателя за той же книгой на чужой сайт
 * незачем — тем более что у нас стих показан рядом с параллельными изданиями
 * и с отзвуками в песнопениях. Наружу остаётся только то, чего у нас нет:
 * сокращения книг, которых наши издания не содержат.
 */
const FootnoteLink = ({ value, footnotes }: IFootnoteLink) => {
    const footnote = footnotes[parseInt(value, 10) - 1];
    const { isBook, book, probablePlace } = isFootnoteBook(footnote);
    const href = footnoteHref(footnote);

    if (href) {
        return (
            <span>
                <Link href={href} className="text-xs text-red-900 cursor-pointer pl-1">
                    {footnote}
                </Link>
            </span>
        );
    }

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
            <a href={`#footnotes-${value}`} className="text-xs text-red-900 cursor-pointer">
                [{value}]
            </a>
        </span>
    );
};

export default FootnoteLink;
