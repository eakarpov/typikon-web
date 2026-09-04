'use client';
import { useState } from "react";
import Link from "next/link";
import { FLAG_LABELS, FLAG_NOTES, type LineFlag } from "@/lib/razbor/labels";
import type { Razbor, RazborLine } from "@/lib/razbor/lookup";

// Окно для набранного текста и разбор под ним.
//
// Разбор приходит запросом, а не собирается на клиенте: сличать надо с
// указателем на двести с лишним тысяч зачинов, и он лежит на сервере.

const MAX_LENGTH = 20_000;

const SAMPLE = `Го́споди, воззва́х к Тебе́, услы́ши мя́
Да испра́вится моли́тва моя́, я́ко кади́ло пред Тобо́ю
Гро́б Тво́й Cпа́се, во́ини стрегу́щии`;

const UNIT_LABELS: Record<string, string> = {
    stichera: "стихира", troparion: "тропарь", kontakion: "кондак", ikos: "икос",
    irmos: "ирмос", sedalen: "седален", svetilen: "светилен", velichanie: "величание",
    prokimen: "прокимен", paremiya: "паремия", apostol: "Апостол", evangelie: "Евангелие",
    molitva: "молитва", ipakoi: "ипакои", verse: "стих",
};

const Flag = ({ flag }: { flag: LineFlag }) => (
    <span
        title={FLAG_NOTES[flag]}
        className={`text-[11px] px-1.5 py-0.5 rounded font-serif ${
            flag === "mixed-script" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}
    >
        {FLAG_LABELS[flag]}
    </span>
);

const Line = ({ line }: { line: RazborLine }) => (
    <li className="border-l-2 border-slate-200 pl-3 py-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs text-slate-400 font-serif">{line.n}</span>
            <span className="font-serif font-sans-serif">{line.text}</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
            {line.found ? (
                <span className="text-xs font-serif text-slate-600">
                    {line.found.byPrefix
                        // Коротка строка — сличали началом, и находка это не
                        // «вот эта стихира», а «зачинов, начинающихся так,
                        // столько-то». Сказать иначе значило бы выдать
                        // перечень за ответ.
                        ? <>строка короткая: зачинов, начинающихся так, — {line.found.witnesses}</>
                        : <>
                            {UNIT_LABELS[line.found.unit ?? ""] ?? line.found.unit ?? "строка"}
                            {line.found.memory ? `, ${line.found.memory}` : ""}
                            {line.found.witnesses > 1 && ` · встречается ${line.found.witnesses} раз`}
                        </>}
                    {" · "}
                    <Link href={`/chants/${line.found.itemId}`} className="text-red-900 hover:underline">
                        в собрании →
                    </Link>
                </span>
            ) : (
                <span className="text-xs font-serif text-slate-400">в собрании не нашлась</span>
            )}
            {line.flags.map(flag => <Flag key={flag} flag={flag} />)}
        </div>
    </li>
);

const Form = () => {
    const [text, setText] = useState("");
    const [result, setResult] = useState<Razbor | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const send = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch("/api/razbor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data?.error ?? "Не удалось разобрать"); setResult(null); }
            else setResult(data as Razbor);
        } catch {
            setError("Не удалось связаться с сервером");
        } finally {
            setBusy(false);
        }
    };

    const found = result?.summary.found ?? 0;
    const total = result?.summary.lines ?? 0;

    return (
        <div className="flex flex-col gap-3">
            <textarea
                className="border rounded p-2 font-serif font-sans-serif w-full h-48"
                placeholder={SAMPLE}
                maxLength={MAX_LENGTH}
                value={text}
                onChange={e => setText(e.target.value)}
            />
            <div className="flex gap-3 items-baseline font-serif text-sm">
                <button
                    onClick={send}
                    disabled={busy || !text.trim()}
                    className="border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                >
                    {busy ? "разбираю…" : "разобрать"}
                </button>
                {!text && (
                    <button onClick={() => setText(SAMPLE)} className="text-red-900 hover:underline">
                        подставить пример
                    </button>
                )}
                <span className="text-xs text-slate-400">
                    {text.length.toLocaleString("ru-RU")} из {MAX_LENGTH.toLocaleString("ru-RU")} знаков
                </span>
            </div>

            {error && <p className="font-serif text-amber-700">{error}</p>}

            {result && (
                <div>
                    <p className="font-serif text-sm text-slate-600">
                        Строк: {total}; нашлось в собрании: {found}
                        {total > found && `; не нашлось: ${total - found}`}
                        {result.summary.flagged > 0 && `; с приметами: ${result.summary.flagged}`}
                    </p>
                    {result.corpusMissing && (
                        <p className="font-serif text-amber-700 text-sm mt-1">
                            Собрание на этом сервере не выложено — сличать не с чем. Приметы строк
                            показаны, поиск не работал.
                        </p>
                    )}
                    <ul className="mt-2 flex flex-col gap-1">
                        {result.lines.map(line => <Line key={line.n} line={line} />)}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Form;
