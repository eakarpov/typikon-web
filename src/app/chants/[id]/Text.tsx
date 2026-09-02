import React from "react";
import type { ChantDetail } from "@/lib/chants";
import type { CitationPart } from "@/lib/citations";

// Уставную кириллицу и румынскую обычным шрифтом не показать: в нём нет ни
// титла, ни юса, и текст осыплется квадратами (тот же приём, что в Steps.tsx).
const LANG_FONT: Record<string, string> = { "cu": "font-sans-serif", "ro_cyr": "font-sans-serif" };

/**
 * Текст песнопения с отзвуками Писания.
 *
 * Косая черта — разрыв строки, как его печатает корпус; она приходит из
 * раскладки отдельным куском, а не режется здесь, потому что цитата разрыв
 * пересекает сплошь и рядом (см. layoutCitations).
 *
 * Разметку строим из кусков, а не вставляем в строку: текст приходит из
 * корпуса, и вставлять его как HTML незачем ни при каких обстоятельствах —
 * то же правило, что у Snippet в выдаче поиска.
 *
 * Уверенное совпадение и догадка различаются НАЧЕРТАНИЕМ, а не только
 * цветом: догадку нельзя показывать как факт, а цвет читатель может и не
 * различить.
 */
const Text = ({ chant, parts }: { chant: ChantDetail; parts: CitationPart[] }) => (
    <p className={`font-serif text-slate-800 leading-relaxed ${LANG_FONT[chant.language] || ""}`}>
        {parts.map((part, i) => {
            if (part.break) return <br key={i} />;
            if (!part.refs.length) return <React.Fragment key={i}>{part.text}</React.Fragment>;
            const where = part.refs.map(c => `${c.canonId} ${c.chapter}:${c.verse}`).join(", ");
            return (
                <mark
                    key={i}
                    className={part.certain ? "chant-citation" : "chant-citation chant-citation--guess"}
                    title={where}
                >
                    {part.text}
                </mark>
            );
        })}
    </p>
);

export default Text;
