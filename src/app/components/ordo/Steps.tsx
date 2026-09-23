import React from "react";
import type { OrdoStep } from "@/lib/ordo";
import { csFontVariables, myFont } from "@/utils/font";

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

// Подписи языков — все, какие есть в корпусе, а не одни славянские. Пока
// метились только `cu` и `ro_cyr`, греческая, английская, румынская и
// эстонская строки шли БЕЗ ПОМЕТЫ, то есть выглядели как наша книга.
// Список тот же, что в typikon-rules/src/languages.py.
const LANG_SHORT: Record<string, string> = {
    "cu_gr": "цс гражд.", "cu": "цс", "ro_cyr": "рум. кир.",
    "grc": "греч.", "ro": "рум.", "en": "англ.", "et": "эст.",
    "ar": "араб.", "ja": "яп.", "zh_wy": "кит.", "la": "лат.",
};

/** Язык самой службы: его не метим, метим отличия от него. */
const BASE_LANG = "cu_gr";

/**
 * Чем оправдана вторая строка. Один адрес значит «то же место службы под тем
 * же номером», а НЕ «перевод»: под одним адресом славянская книга печатает
 * кондак преподобному, а греческая — предпразднству Богоявления. Показать их
 * рядом без знака значит соврать молча.
 */
const BASIS_MARK: Record<string, { знак: string; что: string }> = {
    "edition": { знак: "⇄", что: "перевод заявлен издателем" },
    "confirmed": { знак: "⇄", что: "перевод подтверждён" },
    "address": { знак: "~", что: "только на том же месте: книги печатают разное" },
};

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

/** Пометка языка — там, где он не язык самой службы: подменять молча нельзя. */
const Lang = ({ lang }: { lang?: string | null }) =>
    lang && lang !== BASE_LANG && LANG_SHORT[lang]
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

/**
 * Та же строка на других языках, подстрочником и со знаком достоверности.
 * Приходит полем `parallel`, когда сборку попросили приложить языки.
 */
const Parallel = ({ item }: { item: any }) => {
    const кто = item.parallel as any[] | undefined;
    if (!кто?.length) return null;
    return (
        <div className="pl-3 mt-0.5 flex flex-col gap-0.5">
            {кто.map((брат, i) => {
                const знак = BASIS_MARK[брат.basis] || BASIS_MARK["address"];
                return (
                    <div key={i} className="text-[13px] text-slate-500">
                        <span className="mr-1 text-slate-400" title={знак.что}>{знак.знак}</span>
                        <Line text={брат.text} lang={брат.language} />
                        <Lang lang={брат.language} />
                        {брат.edition && (
                            <span className="text-[10px] text-slate-400 ml-2">{брат.edition}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

/** Обычная строка места: текст, язык, откуда, и языки рядом. */
const Plain = ({ item, cue }: { item: any; cue?: boolean }) => (
    <>
        <Line text={cue ? cueOf(item.text || item.cue) : (item.text || item.cue)} lang={item.language} />
        <Lang lang={item.language} />
        <Cite item={item} />
        <Parallel item={item} />
    </>
);

// ── Канон ────────────────────────────────────────────────────────────────
//
// Канон — ОДНА позиция, а её единицы разнородны: заголовки канонов, заголовки
// песней, ирмосы, тропари, стихи библейских песней, припевы, катавасия и
// вложенные шаги (ектения по 3-й песни, седален). Пока их рисовали общим
// списком, двести единиц шли неразличимой простынёй, а вложенные шаги —
// ПУСТЫМИ строками: текста у них нет, он внутри шага.

const OdeHeader = ({ item }: { item: any }) => (
    <div className="text-sm font-serif text-slate-600 mt-2">
        ── Песнь {item.ode} ──
        {item.biblical && (
            <span className="text-[11px] text-slate-400 ml-2">{item.biblical}</span>
        )}
    </div>
);

const CanonHead = ({ item }: { item: any }) => {
    const как = item.irmos_dvazhdy ? "ирмос поётся дважды"
        : item.irmos_sung ? "ирмос поётся"
        : item.bez_irmosov ? `без ирмосов, напев по: ${cueOf(item.irmos_ref)}`
        : `ирмос не поётся, напев по: ${cueOf(item.irmos_ref)}`;
    return (
        <div className="text-sm font-serif text-slate-600 mt-1">
            Канон {item.index} ({item.book_label}
            {item.tone ? `, глас ${item.tone}` : ""}): {как}
            {item.katavasia_from && ", с него катавасия"}
        </div>
    );
};

/** Единица канона, названная своим именем. Неузнанная — как обычная строка. */
const CanonUnit = ({ item, depth, cue }: { item: any; depth: number; cue?: boolean }) => {
    if (item.is_nested_step) {
        // Ектения или седален, перенесённые внутрь канона: это ШАГ, и рисует
        // его тот же Step, иначе выйдет пустая строка.
        return <Step step={{ ...item.step, depth: depth + 1 }} />;
    }
    if (item.is_canon_head) return <CanonHead item={item} />;
    if (item.is_ode_header) return <OdeHeader item={item} />;

    const подпись = item.is_irmos
        ? `Ирмос (${item.book_label}${item.tone ? `, глас ${item.tone}` : ""})`
        : item.is_katavasia
            ? `${item.is_pokryvayushchiy ? "Покрывающий ирмос" : "Катавасия"}`
                + ` (${item.book_label}${item.tone ? `, глас ${item.tone}` : ""})`
            : item.is_biblical_verse ? (item.verse_label || "Стих")
                : item.is_pripev ? "Припев"
                    : item.book_label || null;
    return (
        <div className="text-sm">
            {подпись && <span className="text-slate-500 mr-1">{подпись}:</span>}
            <Line text={cue ? cueOf(item.text || item.cue) : (item.text || item.cue)} lang={item.language} />
            <Lang lang={item.language} />
            <Parallel item={item} />
        </div>
    );
};

const isCanon = (items: any[]) =>
    items.some(it => it.is_canon_head || it.is_ode_header || it.is_irmos
        || it.is_troparion || it.is_katavasia || it.is_biblical_verse);

const Canon = ({ items, depth, cue }: { items: any[]; depth: number; cue?: boolean }) => {
    let последний: string | null = null;
    return (
        <div className="pl-3 border-l border-slate-200 flex flex-col gap-0.5 mt-1">
            {items.map((item, i) => {
                // Граница канонов: пока подпись не менялась, тропари идут
                // подряд, и где кончился один канон — не видно.
                if (item.is_ode_header) последний = null;
                const рубеж = item.canon_label && item.canon_label !== последний
                    ? (последний = item.canon_label) : null;
                return (
                    <React.Fragment key={i}>
                        {рубеж && (
                            <div className="text-[11px] text-slate-400 font-serif mt-1">
                                ── {рубеж} ──
                            </div>
                        )}
                        <CanonUnit item={item} depth={depth} cue={cue} />
                    </React.Fragment>
                );
            })}
        </div>
    );
};

/**
 * `cue` — строки места зачином: в схеме и в чужих местах тетради нужно
 * опознание, а не текст (assemble.cued в движке делает то же).
 */
const Items = ({ items, depth, cue }: { items: any[]; depth: number; cue?: boolean }) => {
    if (isCanon(items)) return <Canon items={items} depth={depth} cue={cue} />;
    return (
        <ol className="list-none pl-3 border-l border-slate-200 flex flex-col gap-1 mt-1">
            {items.map((item, i) => (
                <li key={i} className="text-sm">
                    {item.is_nested_step
                        ? <Step step={{ ...item.step, depth: depth + 1 }} />
                        : <Plain item={item} cue={cue} />}
                </li>
            ))}
        </ol>
    );
};

/** Уставное действие при этом месте: главы Типикона 22–31. */
const Actions = ({ step }: { step: OrdoStep }) => {
    const acts = step.actions as any[] | undefined;
    if (!acts?.length) return null;
    const край = step.is_service_edge as string | undefined;
    const где = край === "nachalo" ? "Прежде начала службы"
        : край === "konets" ? "По окончании службы"
        : край === "nemesto" ? "Места в этой канве не нашлось" : null;
    return (
        <>
            {acts.map((act, i) => (
                <div key={i} className="font-serif text-xs text-slate-500 italic">
                    [{где ? `${где}: ` : ""}{act.label}
                    {act.chapter && ` — Типикон, гл. ${act.chapter}`}
                    {act.by_cue && ` (по зачину «${act.by_cue}»)`}]
                </div>
            ))}
        </>
    );
};

/**
 * Степени тетради роли (assemble.ROLE_VIEWS): своё — крупно и с чертой слева,
 * чужое — мельче и бледнее, но целиком. `cue` режется в самих строках.
 */
const DISPLAY_CLASS: Record<string, string> = {
    loud: "border-l-2 border-red-900/50 pl-2 [&_.text-sm]:text-base",
    quiet: "opacity-60 [&_.text-sm]:text-[13px]",
};

const Step = ({ step }: { step: OrdoStep }) => {
    if (step.display === "hidden") return null;
    const tone = step.display ? DISPLAY_CLASS[step.display] : undefined;
    return tone ? <div className={tone}><StepBody step={step} /></div> : <StepBody step={step} />;
};

const StepBody = ({ step }: { step: OrdoStep }) => {
    const cue = step.display === "cue";

    const depth = step.depth ?? 0;
    const pad = { marginLeft: `${depth * 14}px` };
    const kind = step.kind;

    // Край службы — это только действие: своего текста у шага нет.
    if (step.is_service_edge) {
        return <div style={pad}><Actions step={step} /></div>;
    }

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
                [<Speaker name={step.speaker} />{step.label}
                {step.poklon && (step.repeat_count > 1 ? " — каждое с поклоном" : " — с поклоном")}]
            </div>
        );
    }

    if (kind === "text") {
        // В схеме текст показан зачином, а не целиком: там нужна структура.
        const body = step.display === "cue" ? (step.cue || cueOf(step.text)) : step.text;
        return (
            <div style={pad} className="text-sm">
                <Actions step={step} />
                <Speaker name={step.speaker} />
                <Line text={body} lang={step.language} />
                <Lang lang={step.language} />
                {step.voiced === "secret" && (
                    <span className="text-[10px] text-slate-400 ml-1">[тайно]</span>
                )}
                {step.repeat_count > 1 && (
                    <span className="text-[11px] text-slate-400 ml-1">
                        ({repeatLabel(step.repeat_count)})
                    </span>
                )}
                {step.poklon && (
                    <span className="text-[10px] text-slate-400 ml-1">
                        [{step.repeat_count > 1 ? "каждое с поклоном" : "с поклоном"}]
                    </span>
                )}
                {/* Адрес формулы (spec/formula.md): по нему на возглас можно
                    сослаться так же, как на стихиру. Мелким и только в
                    подсказке — это ссылка, а не слово службы. */}
                {step.address && (
                    <span className="text-[10px] text-slate-300 ml-2" title={step.address}>
                        ⚓
                    </span>
                )}
            </div>
        );
    }

    if (kind === "psalmody") {
        return (
            <div style={pad} className="text-sm">
                <Actions step={step} />
                <span className="font-serif text-slate-600">
                    {step.label}
                    {step.psalm_ref && <span className="text-slate-400"> — {step.psalm_ref}</span>}
                    {step.condition_text && (
                        <span className="text-[11px] text-slate-400 ml-2">{step.condition_text}</span>
                    )}
                </span>
                {step.items?.length ? <Items items={step.items} depth={depth} cue={cue} /> : null}
            </div>
        );
    }

    // position | table | otpust — места, наполняемые из книг по уставу
    const needs = step.needs as string[] | undefined;
    return (
        <div style={pad} className="mt-2">
            <Actions step={step} />
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
                ? <Items items={step.items} depth={depth} cue={cue} />
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
    <div className={`${myFont.variable} ${csFontVariables} flex flex-col`}>
        {steps.map((step, i) => <Step key={i} step={step} />)}
    </div>
);

export default Steps;
