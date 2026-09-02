import React from "react";
import Link from "next/link";
import { citedVerses, echoesHref, verseHref, type Citation } from "@/lib/citations";
import { canonBookName } from "@/utils/bibleCanon";

/**
 * Отзвуки Писания списком ПОД текстом, а не ссылками внутри абзаца.
 *
 * Строка песнопения бывает на три четверти цитатой, и абзац, весь состоящий
 * из подчёркнутых ссылок, перестаёт читаться как песнопение. Само песнопение
 * остаётся текстом, аппарат стоит при нём.
 *
 * Уверенное и догадки разведены: догадка — это трёхсловное совпадение, а
 * богослужебный язык формулен, и три слова подряд не значат ничего сами по
 * себе. Выбрасывать их незачем, выдавать за цитату — нельзя.
 */
const Row = ({ citation }: { citation: Citation }) => (
    <li className="inline-flex items-baseline gap-1 mr-3">
        <Link href={verseHref(citation)} className="text-sky-700 hover:underline">
            {canonBookName(citation.canonId)} {citation.chapter}:{citation.verse}
        </Link>
        <Link
            href={echoesHref(citation)}
            className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
            title="Где ещё звучит это место"
        >
            отзвуки
        </Link>
    </li>
);

const Citations = ({ citations }: { citations: Citation[] }) => {
    const all = citedVerses(citations);
    const sure = all.filter(c => c.confidence === "certain");
    const guessed = all.filter(c => c.confidence !== "certain");
    if (!all.length) return null;

    return (
        <section className="mt-6 text-sm font-serif">
            {sure.length > 0 && (
                <>
                    <h2 className="text-slate-500 mb-1">Отзвуки Писания</h2>
                    <ul className="text-slate-700">{sure.map(c => <Row key={c.canonRef} citation={c} />)}</ul>
                </>
            )}
            {guessed.length > 0 && (
                <>
                    <h2 className="text-slate-400 mt-3 mb-1">
                        Созвучия покороче — общее место богослужебного языка чаще, чем цитата
                    </h2>
                    <ul className="text-slate-500">{guessed.map(c => <Row key={c.canonRef} citation={c} />)}</ul>
                </>
            )}
        </section>
    );
};

export default Citations;
