import React from "react";
import type { OrdoUkazParagraph, OrdoUkazRun } from "@/lib/ordo";

// «Богослужебные указания» — рассказ о службе, а не служба с обрезанными
// текстами: «Ектения великая», «стихиры на 8: праздника, глас 6-й». Прозу
// пишет движок (typikon-rules/src/ukazaniya.py), здесь только вёрстка.
// Образец речи — patriarchia.ru/bu.

const Run = ({ run }: { run: OrdoUkazRun }) => {
    switch (run.s) {
        case "b":
            return <b className="font-semibold">{run.t}</b>;
        case "sub":
            return <span className="text-slate-500 text-[13px]">{run.t}</span>;
        case "miss":
            return <span className="text-red-800 italic">{run.t}</span>;
        case "plain":
            return <span className="text-slate-600">{run.t}</span>;
        case "cite":
            // из какой книги — коротко; полная ссылка в подсказке
            return run.href
                ? <a href={run.href} target="_blank" rel="noopener noreferrer" title={run.title}
                     className="text-[12px] text-slate-400 hover:text-red-900">{run.t}</a>
                : <span title={run.title} className="text-[12px] text-slate-400">{run.t}</span>;
        case "rule":
            // Ярлык слоя устава. Указания без ссылки на устав — пересказ,
            // которому нечем себя подтвердить.
            return (
                <span title={run.note || undefined}
                      className="text-[10px] px-1 py-0.5 ml-1 rounded bg-slate-100 text-slate-500 whitespace-nowrap">
                    {run.label}{run.note ? " ?" : ""}
                </span>
            );
        default:
            return <>{run.t}</>;
    }
};

const Ukazaniya = ({ paragraphs }: { paragraphs: OrdoUkazParagraph[] }) => {
    if (!paragraphs.length) {
        return <p className="font-serif text-sm text-slate-500">Указаний к этой службе нет.</p>;
    }
    return (
        <div className="font-serif leading-relaxed max-w-[44em]">
            {paragraphs.map((p, i) => p.kind === "head"
                ? <h3 key={i} className="text-sm uppercase tracking-wide text-red-900 mt-4 mb-2">{p.text}</h3>
                : (
                    <p key={i} className={`mb-2 ${p.plain ? "text-slate-600" : ""}`}>
                        {p.runs.map((r, j) => <Run key={j} run={r} />)}
                    </p>
                ))}
        </div>
    );
};

export default Ukazaniya;
