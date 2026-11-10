import React from "react";
import TextMarkup from "./TextMarkup";

export default function Poems({ value, footnotes = [], markdown = false }: {
    value?: string; footnotes?: string[]; markdown?: boolean;
}) {
    if (!value?.trim()) return null;
    return <div className="space-y-2 mt-2">
        <p className="font-serif"><b>Стихи́:</b></p>
        {value.replace(/\r\n?/g, "\n").split(/\n\s*\n/).filter(block => block.trim()).map((block, i) =>
            <div key={i} className="whitespace-pre-wrap font-serif italic first-letter:text-red-600">
                <TextMarkup text={block} footnotes={footnotes} markdown={markdown} />
            </div>)}
    </div>;
}
