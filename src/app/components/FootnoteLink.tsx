export interface IFootnoteLink {
    value: string;
    footnotes: string[];
}

const FootnoteLink = ({ value, footnotes }: IFootnoteLink) => {
    const footnote = footnotes[parseInt(value, 10) - 1];
  return <span className="text-xs text-stone-500 cursor-pointer">{value} ({footnote})</span>
};

export default FootnoteLink;
