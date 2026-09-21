'use client';
import { useState } from "react";
import { useEngine } from "./useEngine";
import { Faint, Failed, Han, Lat, Loading, plural } from "./ui";
import type { CharEntry, Engine, Reading } from "@/lib/azbuki/chinese/types";

// Разбор одного иероглифа: откуда взялось написание и что из него выводится.
//
// Показываем все чтения, а не одно: у многочтенного знака каждое фиксирует своё
// значение, и орфография записывает их по-разному — 說 «говорить» это śvet,
// а 說 «убеждать» — śvejs. Свести их к одному значило бы потерять то самое,
// ради чего орфография и строится.

interface Cognate { c: string; n: number; oc: string; f: [string, string, string, string][] }

const Cognates = ({ list }: { list: Cognate[] }) => (
    <>
        {list.map((c, i) => (
            <div key={i} className="mt-3 pt-2 border-t border-dotted border-slate-300">
                <p className="font-serif text-sm">
                    <b>Сино-тибетские когнаты</b>{" "}
                    <Faint>
                        «{c.c}», {c.n} {plural(c.n, "язык", "языка", "языков")} семьи,
                        древнекитайское <span className="font-mono">{c.oc}</span>
                    </Faint>
                </p>
                {/* по одному представителю от подгруппы: иначе полсотни форм */}
                <p className="font-serif text-sm text-slate-600 mt-1">
                    {Object.values(
                        c.f.reduce<Record<string, [string, string, string, string]>>((acc, f) => {
                            if (f[0] !== "Sinitic" && !acc[f[0]]) acc[f[0]] = f;
                            return acc;
                        }, {}),
                    ).slice(0, 10).map((f, j) => (
                        <span key={j}>
                            {j > 0 && " · "}
                            <Faint>{f[0]}</Faint> <span className="font-mono">{f[3]}</span>
                        </span>
                    ))}
                </p>
            </div>
        ))}
    </>
);

const ReadingCard = ({ r, entry, cl }: { r: Reading; entry: CharEntry; cl: Engine }) => {
    const s = r.syl;
    const der = cl.core.derive(s);
    const attested: Record<string, string | undefined> = {
        putonghua: entry.m?.cmn?.[0],
        gwongzau: entry.m?.yue?.[0],
    };
    const hom = cl.core.homophones(s.l, null);

    return (
        <div className="border-t border-slate-200 pt-3 mt-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Lat artificial={r.artificial} className="text-xl font-bold">{s.l}</Lat>
                {r.primary && (
                    <span className="text-xs bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">основное</span>
                )}
                {r.artificial && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">назначено</span>
                )}
                <Han className="text-sm text-slate-600">{s.p}</Han>
                <Faint><span className="font-mono text-sm">Бакстер {s.b}</span></Faint>
                {r.fanqie && <Faint>反切 <Han>{r.fanqie}</Han></Faint>}
            </div>

            {r.gloss && <p className="font-serif text-sm text-slate-700 mt-1">{r.gloss}</p>}
            {r.artificial && (
                <p className="font-serif text-sm text-slate-500 italic mt-1">
                    Среднекитайского предка у этой морфемы нет. Позиция подобрана, а не
                    унаследована: написание показывает, как слово выглядело бы в системе,
                    но не свидетельствует ни о чём.
                </p>
            )}

            <p className="font-serif text-sm text-slate-600 mt-1">
                {cl.core.describe(cl.core.parse(s.l))} · {s.v}
                {s.r ? " · несёт метку *-r-" : ""}
            </p>

            <p className="font-serif text-sm mt-1">
                {Object.keys(cl.core.DERIVERS).map((name, i) => {
                    const d = (der as Record<string, string | null | undefined>)[name];
                    if (!d) return null;
                    const a = attested[name];
                    const verdict = a ? cl.core.compareReading(d, a) : null;
                    const cls = verdict === "exact" ? "text-green-800"
                        : verdict === "segments" ? ""
                        : verdict ? "text-amber-800" : "text-slate-400";
                    return (
                        <span key={name}>
                            {i > 0 && <span className="text-slate-400"> · </span>}
                            <Faint>{cl.core.DERIVERS[name]} по правилам</Faint>{" "}
                            <span className={`font-mono ${cls}`}>{d}</span>
                            {verdict === "segments" && <Faint> (тон иной, факт {a})</Faint>}
                            {verdict === "differs" && <Faint> (факт {a})</Faint>}
                        </span>
                    );
                })}
            </p>

            <p className="font-serif text-sm text-slate-600 mt-1">
                {hom.length > 1 ? (
                    <>
                        Это написание {plural(hom.length, "делит", "делят", "делят")} {hom.length}{" "}
                        {plural(hom.length, "иероглиф", "иероглифа", "иероглифов")}:{" "}
                        {hom.slice(0, 24).map((c, i) => <Han key={i}>{c} </Han>)}
                        {hom.length > 24 && "…"}
                    </>
                ) : "Написание уникально."}
            </p>
        </div>
    );
};

const CharCard = ({ ch, cl }: { ch: string; cl: Engine }) => {
    const res = cl.core.lookup(ch);
    if (!res) {
        return (
            <div className="mb-6">
                <Han className="text-4xl">{ch}</Han>
                <p className="font-serif text-amber-800">
                    Нет данных: иероглиф не найден ни в «Гуанъюне», ни в таблице вариантов.
                </p>
            </div>
        );
    }
    const e = res.entry;
    const rs = cl.core.readings(e);
    const cog = (cl.cognates?.[res.via || ch] || cl.cognates?.[ch]) as Cognate[] | undefined;
    const modern = cl.core.modern(e);

    return (
        <div className="mb-8">
            <div className="flex gap-4 items-start">
                <Han className="text-5xl leading-none">{ch}</Han>
                <div className="font-serif text-sm flex-1">
                    {res.via && (
                        <p>Чтения взяты по традиционной форме <Han>{res.via}</Han>.</p>
                    )}
                    {e.f && <p className="text-slate-600">Частотный ранг: {e.f}</p>}
                    {e.d && <p className="text-slate-600">{e.d}</p>}
                    {modern.map(m => (
                        <p key={m.name}>
                            <Faint>{m.name}</Faint> <span className="font-mono">{m.values.join(", ")}</span>
                        </p>
                    ))}
                    {cog?.length ? <Cognates list={cog} /> : null}
                </div>
            </div>

            {!rs.length ? (
                <p className="font-serif text-slate-500 italic mt-3">
                    Среднекитайских чтений нет — иероглиф отсутствует в «Гуанъюне».
                </p>
            ) : (
                <>
                    {rs.length > 1 && (
                        <p className="font-serif text-sm text-slate-600 mt-3">
                            {rs.length} {plural(rs.length, "чтение", "чтения", "чтений")}. Каждое
                            фиксирует своё значение, поэтому в орфографии они записываются по-разному.
                        </p>
                    )}
                    {rs.map((r, i) => <ReadingCard key={i} r={r} entry={e} cl={cl} />)}
                </>
            )}
        </div>
    );
};

const Character = () => {
    const { engine, error } = useEngine("character");
    const [value, setValue] = useState("二");

    const chars = engine
        ? engine.core.tokenize(value).filter(t => t.han).map(t => t.ch)
        : [];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 max-w-xs">
                <label htmlFor="ch-input" className="font-serif text-sm text-slate-500">
                    Иероглиф или несколько
                </label>
                <input
                    id="ch-input"
                    type="text"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    className="border border-slate-300 rounded px-2 py-1 font-serif text-lg"
                />
            </div>

            {error ? <Failed error={error} /> : !engine ? <Loading what="словарь чтений" /> : (
                chars.length === 0
                    ? <p className="font-serif text-slate-500 italic">Введите иероглиф.</p>
                    : <>
                        {chars.slice(0, 8).map((ch, i) => <CharCard key={ch + i} ch={ch} cl={engine} />)}
                        {chars.length > 8 && (
                            <p className="font-serif text-sm text-slate-500">Показаны первые восемь знаков.</p>
                        )}
                    </>
            )}
        </div>
    );
};

export default Character;
