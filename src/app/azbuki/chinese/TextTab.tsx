'use client';
import { useMemo, useState } from "react";
import { useEngine } from "./useEngine";
import { Failed, Han, Lat, Loading } from "./ui";
import type { Engine, Segment } from "@/lib/azbuki/chinese/types";

// Текст иероглифами → латиница и произношение.
//
// Границы слов берутся из CC-CEDICT наибольшим совпадением. Словарь нужен не
// только для пробелов: он же задаёт чтение многочтенного знака в контексте —
// 行 в 銀行 читается háng, а в 行動 xíng, и без словаря пришлось бы выбирать
// наугад.

const VARIETIES: [string, string][] = [
    ["cmn", "путунхуа"],
    ["yue", "кантонский"],
    ["jpn_on", "японское онъёми"],
    ["kor", "корейское"],
    ["vie", "вьетнамское"],
];
const DERIVER_OF: Record<string, string> = { cmn: "putonghua", yue: "gwongzau" };

// CC-CEDICT пишет тон цифрой (hang2); переводим в диакритику для читаемости
const MARKS: Record<string, string> = {
    a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", "ü": "ǖǘǚǜ",
};
function numToneToMark(s: string) {
    const m = /^([A-Za-z:]+)([1-5])$/.exec(s);
    if (!m) return s;
    const body = m[1].replace(/u:/g, "ü").toLowerCase();
    const tone = parseInt(m[2], 10);
    if (tone === 5) return body;
    const target = /a/.test(body) ? "a" : /o/.test(body) ? "o" : /e/.test(body) ? "e"
        : /iu$/.test(body) ? "u" : /ü/.test(body) ? "ü"
        : /u/.test(body) ? "u" : /i/.test(body) ? "i" : null;
    if (!target) return body;
    return body.replace(target, MARKS[target][tone - 1]);
}

interface Stats {
    han: number; words: number; inDict: number; byDict: number;
    ambiguous: number; missing: number; apos: number; derived: number; art: number;
}

const Line = ({ segs, variety, cl }: {
    segs: Segment[]; variety: string; cl: Engine;
}) => {
    // Пробел ставится только между двумя словами. Знаки препинания приходят из
    // исходного текста со своими пробелами, и лишний дал бы «śvejs ： 「 krimthen».
    let prevWord = false;
    const src: JSX.Element[] = [], lat: JSX.Element[] = [], read: JSX.Element[] = [];

    segs.forEach((seg, i) => {
        if (seg.type === "other") {
            src.push(<span key={i}>{seg.text}</span>);
            lat.push(<span key={i}>{seg.text}</span>);
            read.push(<span key={i}>{seg.text}</span>);
            prevWord = false;
            return;
        }
        src.push(
            <Han key={i} className={seg.inDict ? "" : "text-slate-500"}>{seg.text}</Han>,
        );
        if (prevWord) { lat.push(<span key={`s${i}`}> </span>); read.push(<span key={`s${i}`}> </span>); }

        let anyAmb = false, anyDict = false, anyMiss = false;
        seg.parts.forEach(p => {
            if (!p.syl) { anyMiss = true; return; }
            if (seg.inDict) { if (p.ambiguous) anyDict = true; }
            else if (p.ambiguous) anyAmb = true;
        });
        const title = seg.parts.map(p =>
            `${p.ch} ${p.syl ? p.syl.l : "?"}${p.fromDict ? " (по словарю)" : ""}` +
            `${p.artificial ? " (назначено)" : ""}`).join(" · ");
        const cls = anyMiss ? "text-red-800"
            : anyAmb ? "underline decoration-dotted decoration-amber-600 underline-offset-4"
            : anyDict ? "underline decoration-dotted decoration-slate-300 underline-offset-4" : "";

        // серым выделяется ровно назначенный слог, а не всё слово целиком
        lat.push(
            <span key={i} className={cls} title={title}>
                {cl.core.wordToLatinChunks(seg.parts).map((c, j) => (
                    <Lat key={j} artificial={c.artificial}>{c.text}</Lat>
                ))}
            </span>,
        );
        prevWord = true;

        const rd = seg.parts.map((p, j) => {
            if (variety === "cmn" && p.pinyin) return <span key={j}>{numToneToMark(p.pinyin)}</span>;
            const m = cl.chars[p.ch]?.m?.[variety];
            if (m) return <span key={j}>{m[0]}</span>;
            // засвидетельствованного чтения нет — подставляем выведенное по правилам
            const name = DERIVER_OF[variety];
            if (name && p.syl) {
                const d = (cl.core.derive(p.syl) as Record<string, string | null | undefined>)[name];
                if (d) return <span key={j} className="text-slate-400" title="выведено по правилам">{d}</span>;
            }
            return <span key={j}>—</span>;
        });
        const sep = variety === "cmn" || variety === "vie" ? " " : "";
        read.push(
            <span key={i} className="font-mono">
                {rd.map((r, j) => <span key={j}>{j > 0 && sep}{r}</span>)}
            </span>,
        );
    });

    return (
        <div className="mb-4">
            <p className="font-serif text-lg" lang="zh">{src}</p>
            <p className="font-mono text-base my-1">{lat}</p>
            <p className="font-serif text-sm text-slate-600">{read}</p>
        </div>
    );
};

function cl_hasApostrophe(cl: Engine, seg: Segment) {
    return cl.core.wordToLatin(seg.parts).includes("'");
}

const TextTab = () => {
    const { engine, error } = useEngine("text");
    const [value, setValue] = useState("中國人民銀行\n他在西安大學學習行動不便的問題");
    const [variety, setVariety] = useState("cmn");

    // Разбор и подсчёт — одним проходом до отрисовки. Считать по ходу рендера
    // нельзя: абзац с числами стоит после строк, но выполняется раньше них,
    // и показывал бы нули.
    const { lines, stats } = useMemo(() => {
        const stats: Stats = {
            han: 0, words: 0, inDict: 0, byDict: 0,
            ambiguous: 0, missing: 0, apos: 0, derived: 0, art: 0,
        };
        if (!engine) return { lines: [] as (Segment[] | null)[], stats };
        const lines = value.split("\n").map(l => (l.trim() ? engine.core.segment(l) : null));
        for (const segs of lines) {
            if (!segs) continue;
            for (const seg of segs) {
                if (seg.type === "other") continue;
                stats.words++;
                stats.han += seg.text.length;
                if (seg.inDict) stats.inDict++;
                if (cl_hasApostrophe(engine, seg)) stats.apos++;
                for (const p of seg.parts) {
                    if (!p.syl) { stats.missing++; continue; }
                    if (p.ambiguous) { if (seg.inDict) stats.byDict++; else stats.ambiguous++; }
                    if (p.artificial) stats.art++;
                    const name = DERIVER_OF[variety];
                    const attested = engine.chars[p.ch]?.m?.[variety];
                    if (!(variety === "cmn" && p.pinyin) && !attested && name) {
                        const d = (engine.core.derive(p.syl) as Record<string, string | null | undefined>)[name];
                        if (d) stats.derived++;
                    }
                }
            }
        }
        return { lines, stats };
    }, [engine, value, variety]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <label htmlFor="tx-input" className="font-serif text-sm text-slate-500">
                    Текст иероглифами
                </label>
                <textarea
                    id="tx-input"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    spellCheck={false}
                    rows={5}
                    className="border border-slate-300 rounded px-2 py-1 font-serif text-lg"
                />
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
                <label className="font-serif text-sm">
                    Произношение:{" "}
                    <select
                        value={variety}
                        onChange={e => setVariety(e.target.value)}
                        className="border border-slate-300 rounded px-1 py-0.5 font-serif"
                    >
                        {VARIETIES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select>
                </label>
            </div>

            {error ? <Failed error={error} />
                : !engine ? <Loading what="словарь слов (2,5 МБ)" />
                : (
                    <>
                        <div>
                            {lines.map((segs, i) =>
                                segs
                                    ? <Line key={i} segs={segs} variety={variety} cl={engine} />
                                    : <div key={i} className="h-3" />)}
                        </div>
                        <p className="font-serif text-sm text-slate-500">
                            иероглифов {stats.han}, слов {stats.words} (из них в словаре {stats.inDict}),
                            чтений по словарю {stats.byDict}, апострофов {stats.apos}
                            {stats.ambiguous > 0 && `, нерешённых многочтений ${stats.ambiguous}`}
                            {stats.derived > 0 && `, чтений выведено по правилам ${stats.derived}`}
                            {stats.art > 0 && `, назначенных написаний ${stats.art}`}
                            {stats.missing > 0 && `, без данных ${stats.missing}`}
                        </p>
                    </>
                )}
        </div>
    );
};

export default TextTab;
