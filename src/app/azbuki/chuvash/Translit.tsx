'use client';
import { useEffect, useMemo, useState } from "react";
import { createTranslit } from "@/lib/azbuki/chuvash/engine";
import { SAMPLES, type ChuvashData, type Translit as Engine } from "@/lib/azbuki/chuvash/types";
import { Chu, Cyr } from "./ui";

// Живой перевод. Словники — 23 КБ, лежат в public/ и забираются один раз при
// открытии азбуки: в бандл страницы их класть незачем.
//
// Переключателями вынесено ровно то, что в азбуке ещё не закреплено, — чтобы
// решение принималось по виду строки, а не по описанию.

const BASE = "/azbuki/chuvash/data.json";

const Translit = () => {
    const [engine, setEngine] = useState<Engine | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ChuvashData | null>(null);
    const [text, setText] = useState(SAMPLES[0].text);
    const [devoice, setDevoice] = useState<"off" | "loans" | "all">("loans");
    const [final, setFinal] = useState<"paerok" | "jer" | "off">("paerok");
    const [titla, setTitla] = useState(true);

    useEffect(() => {
        let alive = true;
        fetch(BASE)
            .then(res => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
            .then((d: ChuvashData) => { if (alive) { setData(d); setEngine(createTranslit(d)); } })
            .catch((e: Error) => { if (alive) setError(e.message); });
        return () => { alive = false; };
    }, []);

    // Переключатели живут в движке, и React за его полем уследить не может —
    // поэтому оба вывода считаются одним расчётом, сразу после установки опций.
    const { out, prayer } = useMemo(() => {
        if (!engine) return { out: "", prayer: "" };
        engine.opt.devoice = devoice;
        engine.opt.final = final;
        engine.opt.titla = titla;
        const render = (s: string) => engine.translit(s).map(p => p.text).join("");
        return { out: render(text), prayer: render(SAMPLES[0].text) };
    }, [engine, text, devoice, final, titla]);

    return (
        <div className="flex flex-col gap-3 max-w-3xl">
            <h2 className="font-serif font-bold">Перевод</h2>
            <div className="flex flex-wrap gap-2">
                {SAMPLES.map(s => (
                    <button key={s.label} type="button" onClick={() => setText(s.text)}
                        className="font-serif text-sm border border-slate-300 rounded px-2 py-0.5
                                   text-slate-600 hover:bg-amber-50">
                        {s.label}
                    </button>
                ))}
            </div>

            <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
                spellCheck={false} lang="cv"
                className="font-serif border border-slate-300 rounded p-2 w-full" />

            <div className="flex flex-wrap gap-4 font-serif text-sm text-slate-600">
                <label className="flex items-center gap-1">оглушать
                    <select value={devoice} onChange={e => setDevoice(e.target.value as typeof devoice)}
                        className="border border-slate-300 rounded px-1 py-0.5">
                        <option value="off">никого</option>
                        <option value="loans">заимствования</option>
                        <option value="all">всех, и имена</option>
                    </select>
                </label>
                <label className="flex items-center gap-1">титла
                    <select value={titla ? "on" : "off"} onChange={e => setTitla(e.target.value === "on")}
                        className="border border-slate-300 rounded px-1 py-0.5">
                        <option value="on">ставить</option>
                        <option value="off">не ставить</option>
                    </select>
                </label>
                <label className="flex items-center gap-1">конечная звонкая
                    <select value={final} onChange={e => setFinal(e.target.value as typeof final)}
                        className="border border-slate-300 rounded px-1 py-0.5">
                        <option value="paerok">паероком, без слога</option>
                        <option value="jer">ером буквой, со слогом</option>
                        <option value="off">ничем, по-чувашски</option>
                    </select>
                </label>
            </div>

            <div className="font-sans-serif border border-slate-300 rounded p-2 min-h-20 text-lg
                            leading-relaxed whitespace-pre-wrap break-words">
                {error
                    ? <span className="text-red-800">Не удалось загрузить словники ({error}). Обновите страницу.</span>
                    : !engine ? <span className="text-slate-500">Загружаются словники…</span> : out}
            </div>
            <p className="font-serif text-sm text-slate-500">
                Ударение ставится само: оно падает на последний нередуцированный гласный, а
                если все редуцированные — на первый слог. Оксия на непоследнем слоге, вария
                на последнем, как в синодальном церковнославянском. Титла ставятся по
                заглавной: <Chu>Аттемӗр</Chu> — обращение к Богу, <Chu>аттемӗр</Chu> — земной
                отец. Когда титла стоят, заглавная остаётся только в начале предложения:
                почтение несёт титло, а не размер буквы.
            </p>

            {data && (
                <>
                    <h2 className="font-serif font-bold mt-2">Слова под титлом</h2>
                    <p className="font-serif text-sm text-slate-500">
                        Закрытый перечень священных имён, как в славянской книге, а не правило
                        «всё с заглавной»: под титлом читатель ждёт имя Божие.
                    </p>
                    <ul className="font-serif text-sm grid grid-cols-2 sm:grid-cols-3 gap-x-6">
                        {Object.entries(data.titla).map(([w, t]) => (
                            <li key={w} className="border-b border-slate-100 py-0.5">
                                <Cyr>{t}</Cyr> <span className="text-slate-400">—</span> <Chu>{w}</Chu>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <h2 className="font-serif font-bold mt-2">Кӗлӗ</h2>
            <div className="grid sm:grid-cols-2 gap-x-6">
                <p className="font-sans-serif text-lg leading-relaxed">{prayer || "…"}</p>
                <p className="text-sm"><Chu>{SAMPLES[0].text}</Chu></p>
            </div>
        </div>
    );
};

export default Translit;
