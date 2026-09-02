import React from "react";
import Link from "next/link";
import type { ChantDetail } from "@/lib/chants";
import { fitTune } from "@/lib/tunes/apply";
import { hasColonMarkup, parseChantText } from "@/lib/tunes/syllables";
import { stretchIssues, toAbc } from "@/lib/tunes/notation/abc";
import { toZnamenny, type ZnamennyLine } from "@/lib/tunes/notation/znamenny";
import { localitiesOf, resolveIn, scoresOf, tuneOffers } from "@/lib/tunes/resolve";
import { NOTATION_LABELS, type Notation } from "@/lib/tunes/types";
import Staff from "./Staff";

// Напев под текстом песнопения.
//
// Выбор — традиция, извод, нотация — держится в адресе страницы, а не в
// состоянии на клиенте. Так на конкретный напев конкретной стихиры можно дать
// ссылку: «вот эта стихира валаамским изводом, крюками», — а без адреса
// ссылаться было бы не на что.

interface Params {
    tradition?: string;
    locality?: string;
    notation?: string;
    /** Выбранные варианты строк, через запятую: «1a,4a». */
    variant?: string;
    /** Где текст: «between» (по умолчанию) или «each» — под каждым станом. */
    lyrics?: string;
}

const linkTo = (id: number, params: Params, patch: Params) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) next.set(k, v);
    const query = next.toString();
    return `/chants/${id}${query ? `?${query}` : ""}`;
};

/** Пилюля выбора. Недоступный вариант не прячем, а гасим: см. tuneOffers. */
const Pill = ({ href, active, muted, children, title }: {
    href?: string; active: boolean; muted?: boolean; title?: string; children: React.ReactNode;
}) => {
    const className = "text-xs font-serif px-2 py-1 rounded border "
        + (active
            ? "bg-red-900 text-white border-red-900"
            : muted
                ? "bg-white text-slate-300 border-slate-200 cursor-default"
                : "bg-white text-slate-600 border-slate-300 hover:border-red-900");
    return href
        ? <Link href={href} className={className} title={title}>{children}</Link>
        : <span className={className} title={title}>{children}</span>;
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-400 font-serif w-20 shrink-0">{label}</span>
        {children}
    </div>
);

/**
 * Крюковая строка: знамя над своим слогом.
 *
 * Слоги одного слова стоят вплотную, слова разделяются просветом — иначе
 * крюковая строка читается сплошным потоком, и границы слов, по которым певчий
 * и ведёт текст, теряются.
 */
const Znamenny = ({ lines }: { lines: ZnamennyLine[] }) => (
    <div className="flex flex-col gap-3">
        {lines.map((line, i) => (
            <div key={i} className="flex flex-wrap items-end">
                {line.cells.map((cell, j) => (
                    <div
                        key={j}
                        className={`flex flex-col items-center ${cell.wordStart && j > 0 ? "ml-2" : ""}`}
                    >
                        <span className="znamenny text-slate-900">{cell.neume}</span>
                        <span className="font-serif text-sm text-slate-800">
                            {cell.syllable}
                            {j === line.cells.length - 1 ? line.trailing : ""}
                        </span>
                    </div>
                ))}
            </div>
        ))}
    </div>
);

/** Заголовок раздела и повод, по которому напева не будет. */
const Nothing = ({ children }: { children: React.ReactNode }) => (
    <section className="mt-6 border-t border-slate-200 pt-4">
        <h2 className="font-serif text-sm text-slate-700 mb-2">Напев</h2>
        <p className="text-sm text-slate-500 font-serif">{children}</p>
    </section>
);

const Tune = ({ chant, params }: { chant: ChantDetail; params: Params }) => {
    // Напев кладётся на КОЛЕНА, а колена размечает книга. Догадаться о них по
    // пунктуации нельзя: у первого гласа запятая дробит лишнее, у третьего не
    // делит там, где надо, — и колена достаются не своим строкам (см.
    // syllables.ts). Показать напев по такому делению значило бы показать
    // неверный напев, а это хуже, чем не показать никакого.
    if (!hasColonMarkup(chant.text)) {
        return (
            <Nothing>
                Колена в этом тексте не размечены — книга не поставила ни черты, ни
                звёздочки, — а без них не видно, где кончается строка напева.
                Показывать напев по запятым мы не станем: он ляжет неверно.
            </Nothing>
        );
    }

    const address = { tone: chant.tone, podoben: chant.podoben, genre: chant.unit };
    const locality = params.locality ?? null;
    const offers = tuneOffers(address, { locality });

    // Традиция из адреса, если она вообще что-то может спеть; иначе первая,
    // которая может. Молча показывать не то, что попросили, нельзя, но и
    // упираться в пустой выбор незачем.
    const asked = offers.find(o => o.tradition.id === params.tradition);
    const chosen = asked?.resolved ? asked : offers.find(o => o.resolved) ?? asked ?? offers[0];

    if (!chosen?.resolved) {
        // Дыра в данных честнее молча пропущенной строки: говорим, какими
        // признаками искали и почему не нашли.
        return (
            <Nothing>
                Напева на это песнопение у нас пока нет
                {chant.tone ? ` (глас ${chant.tone}` : " (гласа книга не назвала"}
                {chant.podoben ? `, подобен «${chant.podoben}»` : ""}
                {`, ${chant.unit})`}.
            </Nothing>
        );
    }

    const { tune, tradition } = chosen.resolved;
    const localities = localitiesOf(tradition.id);

    // Нотации показываем не все, какие традиция объявила, а те, в которых у
    // ЭТОГО напева есть запись: заявленная, но не набранная нотация открывалась
    // бы пустым станом.
    const notations = tradition.notations.filter(n => scoresOf(tune, n).length > 0);
    const notation: Notation = (notations.includes(params.notation as Notation)
        ? params.notation as Notation
        : notations[0]);

    // Варианты берём только те, что у этого напева есть: в адресе может
    // остаться выбор от соседнего напева, и молча тащить его сюда нельзя.
    const known = new Set((tune.variants ?? []).map(v => v.id));
    const picked = (params.variant ?? "").split(",").filter(id => known.has(id));

    const fitted = fitTune(tune, parseChantText(chant.text), picked);
    const scores = scoresOf(tune, notation);
    const source = scores.find(s => s.source)?.source;
    // Расхождения раскладки со схемой плюс те, что видны только по нотам.
    const issues = [
        ...fitted.issues,
        ...(notation === "staff" && scores[0] ? stretchIssues(fitted, scores[0]) : []),
    ];

    return (
        <section className="mt-6 border-t border-slate-200 pt-4">
            <h2 className="font-serif text-sm text-slate-700 mb-3">Напев</h2>

            <div className="flex flex-col gap-2 mb-4">
                <Row label="традиция">
                    {offers.map(offer => (
                        <Pill
                            key={offer.tradition.id}
                            href={offer.resolved
                                ? linkTo(chant.id, params, { tradition: offer.tradition.id })
                                : undefined}
                            active={offer.tradition.id === tradition.id}
                            muted={!offer.resolved}
                            title={offer.resolved ? offer.tradition.note : "напева на это песнопение нет"}
                        >
                            {offer.tradition.title}
                        </Pill>
                    ))}
                </Row>

                {localities.length > 0 && (
                    <Row label="извод">
                        <Pill
                            href={linkTo(chant.id, params, { locality: undefined })}
                            active={tune.locality === null}
                        >
                            общий
                        </Pill>
                        {localities.map(l => (
                            <Pill
                                key={l.id}
                                href={linkTo(chant.id, params, { locality: l.id })}
                                active={tune.locality === l.id}
                            >
                                {l.title}
                            </Pill>
                        ))}
                    </Row>
                )}

                {(tune.variants ?? []).map(variant => {
                    const active = picked.includes(variant.id);
                    const without = picked.filter(id => id !== variant.id);
                    return (
                        <Row key={variant.id} label={`строка ${variant.line + 1}`}>
                            <Pill
                                href={linkTo(chant.id, params, { variant: without.join(",") || undefined })}
                                active={!active}
                            >
                                основной
                            </Pill>
                            <Pill
                                href={linkTo(chant.id, params, { variant: [...without, variant.id].join(",") })}
                                active={active}
                            >
                                {variant.label}
                            </Pill>
                        </Row>
                    );
                })}

                {notation === "staff" && scores.length > 1 && (
                    // Обиход печатает текст между станами — оба хора читают его
                    // разом. Под каждым станом набирают там, где хоры поют по
                    // разным листам; это второй способ, а не отсутствие текста.
                    <Row label="текст">
                        <Pill
                            href={linkTo(chant.id, params, { lyrics: undefined })}
                            active={params.lyrics !== "each"}
                        >
                            между строк
                        </Pill>
                        <Pill
                            href={linkTo(chant.id, params, { lyrics: "each" })}
                            active={params.lyrics === "each"}
                        >
                            под каждой
                        </Pill>
                    </Row>
                )}

                {notations.length > 1 && (
                    <Row label="запись">
                        {notations.map(n => (
                            <Pill
                                key={n}
                                href={linkTo(chant.id, params, { notation: n })}
                                active={n === notation}
                            >
                                {NOTATION_LABELS[n]}
                            </Pill>
                        ))}
                    </Row>
                )}
            </div>

            <p className="font-serif text-sm text-slate-700">
                {tune.title}
                <span className="text-slate-400 text-xs ml-2">{chosen.resolved.why}</span>
            </p>

            <div className="mt-3">
                {notation === "znamenny"
                    ? <Znamenny lines={toZnamenny(fitted, scores[0])} />
                    : <Staff abc={toAbc(fitted, scores, { lyrics: params.lyrics === "each" ? "each" : "between" })} />}
            </div>

            {notation === "znamenny" && (
                // Знамёна показываются шрифтом читателя, и без него строка
                // осыплется в пустые прямоугольники. Сказать об этом надо
                // заранее: иначе пустые квадраты читаются как ошибка сайта.
                <p className="text-[11px] text-slate-400 font-serif mt-3">
                    Знамёна набраны символами Юникода. Если вместо них видны пустые
                    прямоугольники, нужен крюковой шрифт — Mezenets Unicode или
                    Voskresensky со страницы шрифтов Славянской компьютерной инициативы.
                </p>
            )}

            {source && (
                <p className="text-[11px] text-slate-400 font-serif mt-2">Запись: {source}.</p>
            )}

            {issues.length > 0 && (
                // Не прячем и не подгоняем: несовпадение напева с текстом —
                // это сообщение правщику данных.
                <ul className="text-[11px] text-amber-700 font-serif mt-2 list-disc pl-4">
                    {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                </ul>
            )}
        </section>
    );
};

export default Tune;
