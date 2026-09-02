import React from "react";
import Link from "next/link";
import type { ChantHit } from "@/lib/chants";
import { bookLanguageShort } from "@/utils/bookLanguages";
import {
    BOOK_LABELS, MARKER_LABELS, PLACEMENT_LABELS, SERVICE_LABELS,
    SIGN_LABELS, UNIT_LABELS, dayOfMonth, labelOf, shortPosition, stanzaLabel,
} from "@/utils/chantLabels";

// Карточка строки корпуса: фрагмент, откуда она и чем является.
//
// Стоит отдельно от выдачи поиска, потому что мест, где она показывается,
// стало два: сам поиск и отзвуки стиха Писания. Пока карточка жила внутри
// Content.tsx, второе место потребовало бы её копии, а две копии одной
// карточки расходятся на первой же правке.

/**
 * Фрагмент найденного. Кусок с hit подсвечивается — но подсветку рисуем сами
 * из размеченных кусков, а не вставляем разметку из строки: текст приходит из
 * корпуса, и вставлять его как HTML незачем ни при каких обстоятельствах.
 */
export const Snippet = ({ parts }: { parts: ChantHit["snippet"] }) => (
    <p className="font-serif text-slate-800">
        {parts.map((part, i) =>
            part.hit
                ? <mark key={i} className="bg-amber-200 text-inherit">{part.text}</mark>
                : <React.Fragment key={i}>{part.text}</React.Fragment>,
        )}
    </p>
);

/**
 * Откуда это песнопение: книга, число месяцеслова, служба, место, глас, знак.
 *
 * У строфы акафиста ничего этого нет — он не день книги и не место службы, —
 * и подпись у неё своя: имя произведения и номер строфы. Без отдельной ветки
 * здесь оставалась бы пустая строка: полей много, а заполнено ни одно.
 */
export const Origin = ({ hit }: { hit: ChantHit }) => {
    const parts = hit.akathist
        ? [hit.akathist, stanzaLabel(hit.unit, hit.stanza, hit.stanzaKind) || null]
            .filter(Boolean)
        : [
            labelOf(BOOK_LABELS, hit.book),
            dayOfMonth(hit.day, hit.month) || null,
            labelOf(SERVICE_LABELS, hit.service),
            shortPosition(hit.position) || null,
            hit.tone ? `глас ${hit.tone}` : null,
            hit.ode ? `песнь ${hit.ode}` : null,
        ].filter(Boolean);

    // Язык называем только у ПЕРЕВОДА. У славянского не называем: он тут по
    // умолчанию, и метка при каждой строке была бы шумом — а вот греческая
    // или румынская строка без метки читается как сбой выдачи.
    //
    // Издание рядом с языком — не педантизм: английских переводов на одно
    // место бывает до четырёх, и это разные работы разных людей.
    if (hit.language && hit.language !== "cu_gr") {
        parts.push(bookLanguageShort(hit.language)
            + (hit.sourceBook && hit.sourceBook.startsWith("en-")
               ? ` (${hit.sourceBook.slice(3)})` : ""));
    }

    return (
        // Полная подпись места — в title: сокращаем показ, а не сведения.
        <div className="text-xs text-slate-500 font-serif" title={hit.position || undefined}>
            {parts.join(" · ")}
        </div>
    );
};

export const Badges = ({ hit }: { hit: ChantHit }) => {
    const badges: string[] = [];
    if (hit.unit) badges.push(labelOf(UNIT_LABELS, hit.unit));
    if (hit.placement) badges.push(labelOf(PLACEMENT_LABELS, hit.placement));
    if (hit.marker) badges.push(labelOf(MARKER_LABELS, hit.marker));
    if (hit.sign) badges.push(labelOf(SIGN_LABELS, hit.sign));

    return (
        <div className="flex flex-wrap gap-1">
            {badges.map(b => (
                <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-serif">
                    {b}
                </span>
            ))}
        </div>
    );
};

/** Карточка целиком — то, чем строка показана в списке. */
export const ChantCard = ({ hit, children }: { hit: ChantHit; children?: React.ReactNode }) => (
    <div className="border-l-2 border-slate-200 pl-3">
        <Origin hit={hit} />
        <div className="font-serif text-sm text-slate-700 mb-1">{hit.memory}</div>
        <Snippet parts={hit.snippet} />
        <Badges hit={hit} />
        {children}
        {/* Показан фрагмент, а песнопение поётся целиком: за полным текстом
            и напевом — на страницу песнопения. */}
        <Link
            href={`/chants/${hit.id}`}
            className="font-serif text-xs text-red-900 inline-block mt-1"
        >
            целиком и с напевом →
        </Link>
    </div>
);
