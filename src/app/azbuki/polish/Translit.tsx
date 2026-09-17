'use client';
import { useEffect, useMemo, useState } from "react";
import { createTranslit } from "@/lib/azbuki/polish/engine";
import { SAMPLES, type Translit as Engine, type YatData } from "@/lib/azbuki/polish/types";
import { Cyr, Lat } from "./ui";

// Живой перевод. Словник — 165 КБ, в бандл страницы столько класть незачем,
// поэтому он лежит в public/ и забирается один раз при открытии азбуки.
// Пока он не пришёл, поле уже видно: механические правила без ятя работать
// не будут, поэтому вместо полуверной записи показывается «загружается».

const CONTROL = [
    {
        title: "Модлитва Паньска",
        text: "Ojcze nasz, który jesteś w niebie, niech się święci imię Twoje! " +
            "Niech przyjdzie królestwo Twoje; niech Twoja wola spełnia się na ziemi, " +
            "tak jak i w niebie. Chleba naszego powszedniego daj nam dzisiaj; " +
            "i przebacz nam nasze winy, jak i my przebaczamy tym, którzy przeciw nam " +
            "zawinili; i nie dopuść, abyśmy ulegli pokusie, ale nas zachowaj od złego! " +
            "Albowiem Twoje jest Królestwo i moc, i chwała na wieki wieków. Amen.",
    },
    {
        title: "Повшехна деклараця прав чловѣка",
        text: "Wszyscy ludzie rodzą się wolni i równi w swojej godności i prawach. " +
            "Są obdarzeni rozumem i sumieniem i powinni postępować wobec siebie " +
            "w duchu braterstwa.",
    },
    {
        title: "Хр̌ѫщ (Ян Бр̌ехва)",
        text: "W Szczebrzeszynie chrząszcz brzmi w trzcinie i Szczebrzeszyn z tego słynie. " +
            "Wół go pyta: Panie chrząszczu, po cóż pan tak brzęczy w gąszczu?",
    },
];

const Translit = () => {
    const [engine, setEngine] = useState<Engine | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [text, setText] = useState(SAMPLES[0].text);
    const [mark, setMark] = useState(false);

    useEffect(() => {
        let alive = true;
        fetch("/azbuki/polish/yat.json")
            .then(res => {
                if (!res.ok) throw new Error(String(res.status));
                return res.json() as Promise<YatData>;
            })
            .then(data => { if (alive) setEngine(createTranslit(data)); })
            .catch((e: Error) => { if (alive) setError(e.message); });
        return () => { alive = false; };
    }, []);

    const out = useMemo(() => (engine ? engine.translit(text) : []), [engine, text]);

    return (
        <div className="flex flex-col gap-3 max-w-3xl">
            <h2 className="font-serif font-bold">Перевод</h2>
            <div className="flex flex-wrap gap-2">
                {SAMPLES.map(s => (
                    <button
                        key={s.label}
                        type="button"
                        onClick={() => setText(s.text)}
                        className="font-serif text-sm border border-slate-300 rounded px-2 py-0.5
                                   text-slate-600 hover:bg-amber-50"
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                spellCheck={false}
                lang="pl"
                rows={4}
                className="font-serif border border-slate-300 rounded p-2 w-full"
            />

            <label className="font-serif text-sm text-slate-600 flex items-center gap-2">
                <input type="checkbox" checked={mark} onChange={e => setMark(e.target.checked)} />
                отмечать места, где словник молчит
            </label>

            <div className="font-serif border border-slate-300 rounded p-2 min-h-24 whitespace-pre-wrap break-words">
                {error
                    ? <span className="text-red-800">Не удалось загрузить словник ({error}). Обновите страницу.</span>
                    : !engine
                        ? <span className="text-slate-500">Загружается словник ятя…</span>
                        : out.map((p, i) => (
                            p.open && mark
                                ? <span key={i} className="border-b border-dotted border-red-800"
                                        title="словник молчит: ять не разобран">{p.text}</span>
                                : <span key={i}>{p.text}</span>
                        ))}
            </div>

            <p className="font-serif text-sm text-slate-500">
                Механично всё, кроме ятя: где стоит <Cyr>ѣ</Cyr>, говорит словник из
                59 697 словоформ. Заимствования узнаются по короткому списку, поэтому
                редкое заимствование запишется как исконное слово.
            </p>

            <h2 className="font-serif font-bold mt-2">Контрольные тексты</h2>
            <p className="font-serif text-sm text-slate-500">
                Записаны тем же переводчиком, что и выше, а не набраны руками.
            </p>
            {CONTROL.map(t => (
                <div key={t.title} className="flex flex-col gap-1">
                    <h3 className="font-serif text-sm font-bold text-slate-600">{t.title}</h3>
                    <div className="grid sm:grid-cols-2 gap-x-6">
                        <p className="font-serif">
                            {engine ? engine.translit(t.text).map(p => p.text).join("") : "…"}
                        </p>
                        <p className="text-sm"><Lat>{t.text}</Lat></p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Translit;
