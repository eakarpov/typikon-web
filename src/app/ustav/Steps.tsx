import React from "react";
import type { OrdoStep } from "@/lib/ordo";
import { csFont, myFont } from "@/utils/font";

// Отрисовка собранного последования.
//
// Шаг несёт не текст, а место в службе: кто произносит, что именно, откуда это
// взято и по какому правилу здесь оказалось. Показываем всё это разом, потому
// что без «откуда» последование нечем проверить, а проверять его придётся —
// устав ещё достраивается.

const LANG_FONT: Record<string, string> = {
    // Уставную кириллицу и румынскую обычным шрифтом не показать: в нём нет ни
    // титла, ни юса, и текст осыплется квадратами. В проекте это Мономах,
    // подключённый в Tailwind под именем sans-serif (см. tailwind.config.js).
    "cu": "font-sans-serif",
    "ro_cyr": "font-sans-serif",
};

const LANG_SHORT: Record<string, string> = { "cu": "цс", "ro_cyr": "рум." };

/**
 * Зачин вместо текста — для устав-схемы, где нужна структура службы, а не
 * содержание. Считаем здесь, а не в службе сборки: это подача, и служба
 * правильно отдаёт данные, помечая шаг как «показать зачином».
 * Пять слов — столько же, сколько берёт просмотрщик в typikon-rules.
 */
const CUE_WORDS = 5;

const cueOf = (text?: string | null): string => {
    if (!text) return "";
    const words = text.split(/\s+/).filter(Boolean);
    return words.slice(0, CUE_WORDS).join(" ") + (words.length > CUE_WORDS ? "…" : "");
};

/** «дважды», «трижды», а дальше — числом, и с правильным словом при нём. */
const repeatLabel = (count: number): string => {
    if (count === 2) return "дважды";
    if (count === 3) return "трижды";
    const tail = count % 10, hundred = count % 100;
    const word = (tail >= 2 && tail <= 4 && (hundred < 12 || hundred > 14)) ? "раза" : "раз";
    return `${count} ${word}`;
};

const Speaker = ({ name }: { name?: string | null }) =>
    name ? <span className="text-red-900 mr-1">{name}:</span> : null;

/** Пометка языка — только там, где он не гражданский: подменять начертание молча нельзя. */
const Lang = ({ lang }: { lang?: string | null }) =>
    lang && LANG_SHORT[lang]
        ? <span className="text-[10px] text-slate-400 ml-1">· {LANG_SHORT[lang]}</span>
        : null;

const Line = ({ text, lang }: { text?: string | null; lang?: string | null }) => {
    if (!text) return null;
    const font = (lang && LANG_FONT[lang]) || "";
    return (
        <span className={`font-serif ${font}`}>
            {text.split("/").map((part, i, all) => (
                <React.Fragment key={i}>
                    {part}
                    {i < all.length - 1 && <br />}
                </React.Fragment>
            ))}
        </span>
    );
};

/** Откуда взята единица: книга и место в ней. Мелким — это подпись, не текст. */
const Cite = ({ item }: { item: any }) => {
    const cite = item.cite || item.book_label;
    if (!cite) return null;
    return <span className="text-[11px] text-slate-400 ml-2 whitespace-nowrap">{cite}</span>;
};

const Items = ({ items }: { items: any[] }) => (
    <ol className="list-none pl-3 border-l border-slate-200 flex flex-col gap-1 mt-1">
        {items.map((item, i) => (
            <li key={i} className="text-sm">
                <Line text={item.text || item.cue} lang={item.language} />
                <Lang lang={item.language} />
                <Cite item={item} />
            </li>
        ))}
    </ol>
);

const Step = ({ step }: { step: OrdoStep }) => {
    if (step.display === "hidden") return null;

    const pad = { marginLeft: `${(step.depth ?? 0) * 14}px` };
    const kind = step.kind;

    if (kind === "include") {
        return (
            <div style={pad} className="font-serif text-sm text-slate-500 mt-3 mb-1">
                ── {step.label} ──
            </div>
        );
    }

    if (kind === "action") {
        return (
            <div style={pad} className="font-serif text-sm text-slate-500 italic">
                [<Speaker name={step.speaker} />{step.label}]
            </div>
        );
    }

    if (kind === "text") {
        // В схеме текст показан зачином, а не целиком: там нужна структура.
        const body = step.display === "cue" ? (step.cue || cueOf(step.text)) : step.text;
        return (
            <div style={pad} className="text-sm">
                <Speaker name={step.speaker} />
                <Line text={body} lang={step.language} />
                <Lang lang={step.language} />
                {step.repeat_count > 1 && (
                    <span className="text-[11px] text-slate-400 ml-1">
                        ({repeatLabel(step.repeat_count)})
                    </span>
                )}
            </div>
        );
    }

    if (kind === "psalmody") {
        return (
            <div style={pad} className="text-sm">
                <span className="font-serif text-slate-600">
                    {step.label}
                    {step.psalm_ref && <span className="text-slate-400"> — {step.psalm_ref}</span>}
                </span>
                {step.items?.length ? <Items items={step.items} /> : null}
            </div>
        );
    }

    // position | table | otpust — места, наполняемые из книг по уставу
    const needs = step.needs as string[] | undefined;
    return (
        <div style={pad} className="mt-2">
            <div className="font-serif text-sm">
                <span className="text-slate-700">{step.label}</span>
                {step.count_hint && <span className="text-slate-400 text-xs ml-2">{step.count_hint}</span>}
                {step.rule?.layer_label && (
                    <span
                        className="text-[10px] px-1 py-0.5 ml-2 rounded bg-slate-100 text-slate-500"
                        title={step.rule.citation || undefined}
                    >
                        {step.rule.layer_label}
                    </span>
                )}
            </div>
            {step.items?.length
                ? <Items items={step.items} />
                : (
                    // Пустое место показываем, а не прячем: дыра в данных
                    // честнее молча пропущенной строки.
                    <div className="text-xs text-slate-400 font-serif pl-3">
                        {needs?.length ? `нечем заполнить: не задан ${needs.join(", ")}` : "пусто"}
                    </div>
                )}
        </div>
    );
};

const Steps = ({ steps }: { steps: OrdoStep[] }) => (
    // Переменные обоих шрифтов нужны здесь разом: гражданский текст и
    // уставная кириллица стоят в одной выдаче через строку.
    <div className={`${myFont.variable} ${csFont.variable} flex flex-col`}>
        {steps.map((step, i) => <Step key={i} step={step} />)}
    </div>
);

export default Steps;
