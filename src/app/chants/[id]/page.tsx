import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChant, type ChantDetail } from "@/lib/chants";
import { citationsOf, layoutCitations } from "@/lib/citations";
import { csFont, myFont } from "@/utils/font";
import {
    BOOK_LABELS, MARKER_LABELS, PLACEMENT_LABELS, SERVICE_LABELS, SIGN_LABELS,
    UNIT_LABELS, labelOf, memoryAddress, shortPosition, stanzaLabel,
} from "@/utils/chantLabels";
import Tune from "./Tune";
import Text from "./Text";
import Citations from "./Citations";
import "./citations.css";

// Страница одного песнопения.
//
// Заведена ради напева: чтобы положить ноты ПОД стихиру, стихиру надо сперва
// показать целиком, а до сих пор её нигде целиком не показывали — поиск отдаёт
// фрагмент, устав отдаёт строку последования. Заодно у песнопения появился
// постоянный адрес, на который можно сослаться.

export const dynamic = "force-dynamic";

const idOf = (raw: string): number | null => {
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
};

export async function generateMetadata(
    { params }: { params: { id: string } },
): Promise<Metadata> {
    const id = idOf(params.id);
    const chant = id ? getChant(id) : null;
    if (!chant) return { title: "Песнопение не найдено — Уставные чтения" };

    const name = labelOf(UNIT_LABELS, chant.unit);
    const where = chant.memory || chant.akathist || "";
    return {
        title: `${name}${where ? `: ${where}` : ""} — Уставные чтения`,
        description: chant.text.replace(/\//g, " ").slice(0, 180),
    };
}

/**
 * Откуда песнопение. У строфы акафиста ничего этого нет — он не день книги и
 * не место службы, — и подпись у неё своя (та же развилка, что в выдаче поиска).
 */
const Origin = ({ chant }: { chant: ChantDetail }) => {
    const parts = chant.akathist
        ? [chant.akathist, stanzaLabel(chant.unit, chant.stanza, chant.stanzaKind) || null]
        : [
            labelOf(BOOK_LABELS, chant.book),
            memoryAddress(chant) || null,
            labelOf(SERVICE_LABELS, chant.service),
            shortPosition(chant.position) || null,
            chant.tone ? `глас ${chant.tone}` : null,
            chant.ode ? `песнь ${chant.ode}` : null,
        ];

    return (
        <p className="text-sm text-slate-500 font-serif" title={chant.position || undefined}>
            {parts.filter(Boolean).join(" · ")}
        </p>
    );
};

const Badges = ({ chant }: { chant: ChantDetail }) => {
    const badges = [
        labelOf(UNIT_LABELS, chant.unit),
        labelOf(PLACEMENT_LABELS, chant.placement),
        labelOf(MARKER_LABELS, chant.marker),
        labelOf(SIGN_LABELS, chant.sign),
        // Подобен — не украшение подписи, а то, чем песнопение поётся; ставим
        // его в один ряд с родом и знаком, а не прячем в примечание.
        chant.podoben ? `подобен «${chant.podoben}»` : "",
        chant.repeat > 1 ? `${chant.repeat} раза` : "",
    ].filter(Boolean);

    return (
        <div className="flex flex-wrap gap-1 mt-2">
            {badges.map(b => (
                <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-serif">
                    {b}
                </span>
            ))}
        </div>
    );
};

const ChantPage = ({
    params, searchParams,
}: {
    params: { id: string };
    searchParams: Record<string, string | undefined>;
}) => {
    const id = idOf(params.id);
    const chant = id ? getChant(id) : null;
    if (!chant) notFound();

    // Смещения цитат посчитаны по той строке, у которой текст СВОЙ: Минея
    // печатает ирмос зачином, а сам он лежит в Ирмологии, и приложи мы
    // смещения Ирмология к зачину — подсветка уехала бы молча.
    const citations = citationsOf(chant.textItemId) ?? [];
    const parts = layoutCitations(chant.text, citations);

    return (
        <div className={`${myFont.variable} ${csFont.variable} pt-2`}>
            <div className="flex items-center gap-2 flex-wrap">
                <Link href="/chants" className="font-serif text-sm text-red-900">← к песнопениям</Link>
                {/* Раздел не закончен, и сказать об этом надо на самой странице,
                    а не только в «Опытах»: сюда приходят из выдачи поиска,
                    минуя всякий список. */}
                <Link
                    href="/opyty"
                    className="text-[11px] font-serif px-1.5 py-0.5 rounded bg-amber-100 text-amber-800"
                >
                    в разработке · опыт
                </Link>
            </div>

            <h1 className="font-bold font-serif mt-2">
                {chant.memory || chant.akathist || labelOf(UNIT_LABELS, chant.unit)}
            </h1>
            <Origin chant={chant} />
            <Badges chant={chant} />

            <div className="mt-4">
                <Text chant={chant} parts={parts} />
                {chant.borrowed && (
                    // Текста в этой книге нет: она печатает зачин, а само
                    // песнопение лежит в Ирмологии или в соседнем каноне.
                    <p className="text-xs text-slate-400 font-serif italic mt-1">
                        Книга печатает здесь зачин; текст взят по ссылке.
                    </p>
                )}
            </div>

            <Citations citations={citations} />

            {chant.canonId && (
                <p className="mt-3">
                    <Link href={`/canons/${chant.canonId}`} className="font-serif text-sm text-red-900">
                        Канон целиком →
                    </Link>
                </p>
            )}

            <Tune chant={chant} params={searchParams} />
        </div>
    );
};

export default ChantPage;
