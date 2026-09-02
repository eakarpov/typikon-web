import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fitTune, groupsOf } from "@/lib/tunes/apply";
import { parseChantText } from "@/lib/tunes/syllables";
import { stretchIssues, toAbc } from "@/lib/tunes/notation/abc";
import { toZnamenny } from "@/lib/tunes/notation/znamenny";
import { tuneLibrary } from "@/lib/tunes/registry";
import { scoresOf } from "@/lib/tunes/resolve";
import { NOTATION_LABELS, type Notation, type Step } from "@/lib/tunes/types";
import Staff from "@/app/chants/[id]/Staff";
import { myFont } from "@/utils/font";

// Один напев на своём образце — страница для сверки с книгой.
//
// Показывает не только ноты, но и РАСКЛАДКУ: какой слог каким шагом поётся.
// Ноты снимаются руками, и ошибиться можно двояко — в самих нотах и в том,
// куда они сели. Первое видно на стане, второе — только в таблице раскладки,
// поэтому она здесь и стоит.

export const dynamic = "force-dynamic";

const find = (id: string[]) => tuneLibrary().tunes.find(t => t.id === id.join("/"));

export async function generateMetadata({ params }: { params: { id: string[] } }): Promise<Metadata> {
    const tune = find(params.id);
    return { title: tune ? `${tune.title} — Уставные чтения` : "Напев не найден — Уставные чтения" };
}

/** Чем шаг является: по этому и сверяют раскладку со схемой. */
const stepLabel = (step: Step): string =>
    // Читок на самом распеве — остановка: нота со штрихом, стоящая на ударном
    // слоге и повторяемая столько раз, сколько нужно тексту, а то и ни разу.
    step.flex && step.stress ? "остановка"
        : step.flex ? "читок"
            : step.stress === "first" ? "распев ↑"
                : step.stress === "last" ? "распев ↓"
                    : "—";

/** Подсказка над слогом: какими шагами он поётся и что с ними сталось. */
const hint = (steps: number[], label: string, held: boolean): string =>
    `${steps.length > 1 ? "шаги" : "шаг"} ${steps.map(i => i + 1).join(", ")}: ${label}`
    + (steps.length > 1 ? ", схлопнуты" : "")
    + (held ? ", тянется" : "");

const TunePage = ({
    params, searchParams,
}: {
    params: { id: string[] };
    searchParams: Record<string, string | undefined>;
}) => {
    const tune = find(params.id);
    if (!tune) notFound();

    const { traditions } = tuneLibrary();
    const tradition = traditions.find(t => t.id === tune.traditionId);
    const notations = (tradition?.notations ?? []).filter(n => scoresOf(tune, n).length > 0);
    const notation: Notation = notations.includes(searchParams.notation as Notation)
        ? searchParams.notation as Notation
        : notations[0];

    const order = [
        tune.order.head.length ? tune.order.head.map(i => i + 1).join(", ") : null,
        tune.order.cycle.length ? `‖: ${tune.order.cycle.map(i => i + 1).join(", ")} :‖` : null,
        tune.order.tail.length ? tune.order.tail.map(i => i + 1).join(", ") : null,
    ].filter(Boolean).join("  ");

    const noLyrics = searchParams.lyrics === "off";
    const link = (patch: Record<string, string | undefined>) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries({ ...searchParams, ...patch })) if (v) next.set(k, v);
        const query = next.toString();
        return `/tunes/${tune.id}${query ? `?${query}` : ""}`;
    };
    const pill = (active: boolean) =>
        "text-xs font-serif px-2 py-1 rounded border "
        + (active ? "bg-red-900 text-white border-red-900" : "bg-white text-slate-600 border-slate-300");

    const colons = tune.sample ? parseChantText(tune.sample.text) : [];
    const fitted = tune.sample ? fitTune(tune, colons) : null;
    const scores = scoresOf(tune, notation);
    const issues = [
        ...(fitted?.issues ?? []),
        ...(fitted && notation === "staff" && scores[0] ? stretchIssues(fitted, scores[0]) : []),
    ];

    return (
        <div className={`${myFont.variable} pt-2`}>
            <Link href="/tunes" className="font-serif text-sm text-red-900">← к напевам</Link>
            <h1 className="font-bold font-serif mt-2">{tune.title}</h1>
            <p className="text-sm text-slate-500 font-serif">
                {[tradition?.title, `порядок строк: ${order}`].filter(Boolean).join(" · ")}
            </p>

            {/* Строение напева — то же, что в книге под схемой. */}
            <section className="mt-4">
                <h2 className="font-serif text-sm text-slate-700 mb-1">Строение</h2>
                <ul className="text-sm font-serif flex flex-col gap-0.5">
                    {tune.lines.map((line, i) => (
                        <li key={i} className="text-slate-700">
                            <span className="text-slate-400 text-xs mr-2">{i + 1}.</span>
                            {line.label && <span className="text-slate-500 mr-2">{line.label}:</span>}
                            {groupsOf(line.steps).map((group, g) => (
                                <React.Fragment key={g}>
                                    {g > 0 && <span className="text-slate-300 mx-1">|</span>}
                                    {group.map(stepLabel).join(" · ")}
                                </React.Fragment>
                            ))}
                        </li>
                    ))}
                </ul>
            </section>

            {!tune.sample && (
                <p className="text-sm text-slate-500 font-serif mt-4">
                    Образцового текста у напева нет — сверить его не на чем.
                </p>
            )}

            {tune.sample && fitted && (
                <>
                    <section className="mt-5">
                        <h2 className="font-serif text-sm text-slate-700 mb-1">Образец</h2>
                        {tune.sample.note && (
                            <p className="text-xs text-slate-500 font-serif mb-1">{tune.sample.note}</p>
                        )}
                        {/* Раскладка по слогам: строка напева, слоги и чем поётся
                            каждый. Читок помечен, распев помечен — так видно не
                            только ЧТО поётся, но и КУДА оно село. */}
                        <table className="text-sm font-serif border-collapse">
                            <tbody>
                                {fitted.colons.map((colon, i) => (
                                    <tr key={i} className="align-baseline">
                                        <td className="text-xs text-slate-400 pr-2 whitespace-nowrap">
                                            строка {colon.line + 1}
                                        </td>
                                        <td className="py-0.5">
                                            {colon.cells.map((cell, j) => {
                                                const step = tune.lines[colon.line].steps[cell.steps[0]];
                                                const mark = cell.flex ? "text-slate-400"
                                                    : step?.stress ? "text-red-900 font-bold"
                                                        : "text-slate-800";
                                                return (
                                                    <span
                                                        key={j}
                                                        className={`${mark} ${cell.wordStart && j > 0 ? "ml-1.5" : ""}`}
                                                        title={hint(cell.steps, stepLabel(step ?? {}), cell.held)}
                                                    >
                                                        {cell.syllable}
                                                        {j === colon.cells.length - 1 ? colon.trailing : ""}
                                                    </span>
                                                );
                                            })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="text-[11px] text-slate-400 font-serif mt-1">
                            Серым — читок, тёмно-красным — распев. При наведении видно номер шага.
                        </p>
                    </section>

                    <div className="flex gap-1.5 mt-4">
                        {notations.length > 1 && notations.map(n => (
                            <Link
                                key={n}
                                href={link({ notation: n })}
                                className={pill(n === notation)}
                            >
                                {NOTATION_LABELS[n]}
                            </Link>
                        ))}
                        {notation === "staff" && (
                            <>
                                <Link href={link({ lyrics: undefined })} className={pill(!noLyrics)}>
                                    текст между строк
                                </Link>
                                <Link href={link({ lyrics: "off" })} className={pill(noLyrics)}>
                                    без слов
                                </Link>
                            </>
                        )}
                    </div>

                    <section className="mt-3">
                        {notation === "znamenny"
                            ? (
                                <div className="flex flex-col gap-3">
                                    {toZnamenny(fitted, scores[0]).map((line, i) => (
                                        <div key={i} className="flex flex-wrap items-end">
                                            {line.cells.map((cell, j) => (
                                                <div key={j} className={`flex flex-col items-center ${cell.wordStart && j > 0 ? "ml-2" : ""}`}>
                                                    <span className="znamenny text-slate-900">{cell.neume}</span>
                                                    <span className="font-serif text-sm text-slate-800">{cell.syllable}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )
                            : <Staff abc={toAbc(fitted, scores, { lyrics: !noLyrics })} />}
                    </section>

                    {issues.length > 0 && (
                        <ul className="text-[11px] text-amber-700 font-serif mt-2 list-disc pl-4">
                            {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                        </ul>
                    )}
                </>
            )}

            {scores.find(s => s.source) && (
                <p className="text-[11px] text-slate-400 font-serif mt-3">
                    Запись: {scores.find(s => s.source)!.source}
                </p>
            )}
        </div>
    );
};

export default TunePage;
