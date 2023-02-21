import reactStringReplace from 'react-string-replace';
import FootnoteLink from "@/app/components/FootnoteLink";

interface ITextPart {
    value: string;
    footnotes: string[];
}

const TextPart = ({ value, footnotes }: ITextPart) => {
    return reactStringReplace(
        value,
        /(\S\d+)/g,
        (footnote) => <FootnoteLink footnotes={footnotes} value={footnote} />,
    );
};

export default TextPart;
