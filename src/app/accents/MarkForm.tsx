'use client';
import React, { useCallback, useMemo, useState } from "react";
import type { MarkResult, Token } from "@/lib/accents/mark";

// Расстановка ударений в присланном тексте.
//
// Главное здесь — что спорные места НЕ проставляются молча. Собрание знает
// «ру́ку» и «руку́», «спа́се» и «спасе́»; выбрать между ними может только тот, кто
// видит фразу целиком. Поэтому такие слова показываются без знака и раскрываются
// в список вариантов с частотами — читатель выбирает сам, и выбор виден в тексте.

const MAX_LENGTH = 20_000;

const GENRES = [
    { value: "reading", label: "Чтение", hint: "Частоты книжных чтений: Пролог, Златоуст, жития" },
    { value: "chant", label: "Песнопение", hint: "Частоты гимнографии: Октоих, Минеи, Триоди, Часослов" },
] as const;

type Genre = (typeof GENRES)[number]["value"];

const Ambiguous = ({ token, chosen, onChoose }: {
    token: Token;
    chosen?: string;
    onChoose: (applied: string | undefined) => void;
}) => {
    const [open, setOpen] = useState(false);

    return (
        <span className="relative inline-block">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className={`underline decoration-dotted underline-offset-4 ${
                    chosen ? "decoration-amber-700" : "bg-amber-100 decoration-amber-800"
                }`}
                title="Собрание даёт два ударения — выберите"
            >
                {chosen ?? token.text}
            </button>
            {open && (
                <span className="absolute z-10 left-0 top-full mt-1 flex flex-col border border-slate-300 rounded bg-white shadow min-w-max">
                    {token.variants?.map((variant) => (
                        <button
                            key={variant.applied}
                            type="button"
                            onClick={() => { onChoose(variant.applied); setOpen(false); }}
                            className={`text-left px-2 py-1 text-sm hover:bg-amber-50 ${
                                chosen === variant.applied ? "font-bold text-amber-800" : ""
                            }`}
                        >
                            {variant.applied}
                            <span className="text-slate-500">
                                {" "}— {variant.count} {variant.count === 1 ? "раз" : "раз"}
                                {", "}{Math.round(variant.share * 100)}%
                            </span>
                        </button>
                    ))}
                    {chosen && (
                        <button
                            type="button"
                            onClick={() => { onChoose(undefined); setOpen(false); }}
                            className="text-left px-2 py-1 text-sm text-slate-500 border-t border-slate-200 hover:bg-slate-50"
                        >
                            Оставить без знака
                        </button>
                    )}
                </span>
            )}
        </span>
    );
};

const MarkForm = () => {
    const [text, setText] = useState("");
    const [genre, setGenre] = useState<Genre>("reading");
    const [result, setResult] = useState<MarkResult | null>(null);
    const [chosen, setChosen] = useState<Record<number, string>>({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    const run = useCallback(async (nextGenre: Genre) => {
        if (!text.trim()) return;
        setBusy(true);
        setError("");
        setCopied(false);
        try {
            const res = await fetch("/api/accents/mark", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, genre: nextGenre }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data?.error || "Не удалось разметить"); setResult(null); return; }
            // Выбор относится к прежней разметке — при новой он больше не годится.
            setChosen({});
            setResult(data);
        } catch {
            setError("Не удалось разметить: сеть не отвечает");
        } finally {
            setBusy(false);
        }
    }, [text]);

    const onGenre = useCallback((next: Genre) => {
        setGenre(next);
        if (result) void run(next);
    }, [result, run]);

    const plain = useMemo(
        () => result?.tokens.map((token, index) => chosen[index] ?? token.text).join("") ?? "",
        [result, chosen],
    );

    const onCopy = useCallback(() => {
        void navigator.clipboard?.writeText(plain).then(() => setCopied(true));
    }, [plain]);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-row flex-wrap items-baseline gap-2">
                <span className="font-serif text-slate-500">Считать частоты по:</span>
                {GENRES.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        aria-pressed={genre === item.value}
                        title={item.hint}
                        onClick={() => onGenre(item.value)}
                        className={`font-serif border rounded px-2 py-0.5 text-sm ${
                            genre === item.value ? "border-amber-800 text-amber-800 font-bold" : "border-slate-300"
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
                rows={7}
                placeholder="Вставьте церковнославянский текст без ударений…"
                className="font-serif border border-slate-300 rounded p-2 w-full"
            />

            <div className="flex flex-row items-center gap-3">
                <button
                    type="button"
                    onClick={() => run(genre)}
                    disabled={busy || !text.trim()}
                    className="font-serif border border-slate-300 rounded px-3 py-1 disabled:opacity-50"
                >
                    {busy ? "Размечаю…" : "Расставить ударения"}
                </button>
                <span className="font-serif text-sm text-slate-500">
                    {text.length}/{MAX_LENGTH}
                </span>
            </div>

            {error && <p className="font-serif text-red-700">{error}</p>}

            {result && (
                <>
                    <p className="font-serif text-sm text-slate-600">
                        Расставлено {result.marked} из {result.expected}
                        {!!result.ambiguous && <> · спорных <b>{result.ambiguous}</b> — нажмите, чтобы выбрать</>}
                        {!!result.unknown && <> · неизвестных {result.unknown}</>}
                    </p>

                    <div className="reading-column border border-slate-300 rounded p-3">
                        <p className="reading-text font-serif text-lg whitespace-pre-wrap">
                            {result.tokens.map((token, index) => {
                                if (token.kind === "ambiguous") {
                                    return (
                                        <Ambiguous
                                            key={index}
                                            token={token}
                                            chosen={chosen[index]}
                                            onChoose={(applied) => setChosen((old) => {
                                                const next = { ...old };
                                                if (applied) next[index] = applied; else delete next[index];
                                                return next;
                                            })}
                                        />
                                    );
                                }
                                if (token.kind === "unknown") {
                                    return (
                                        <span
                                            key={index}
                                            className="underline decoration-dotted decoration-slate-400 underline-offset-4"
                                            title="Слова нет ни в одном источнике"
                                        >
                                            {token.text}
                                        </span>
                                    );
                                }
                                return <React.Fragment key={index}>{token.text}</React.Fragment>;
                            })}
                        </p>
                    </div>

                    <div className="flex flex-row items-center gap-3">
                        <button
                            type="button"
                            onClick={onCopy}
                            className="font-serif border border-slate-300 rounded px-3 py-1 text-sm"
                        >
                            {copied ? "Скопировано" : "Скопировать"}
                        </button>
                        <span className="font-serif text-sm text-slate-500">
                            Спорные без выбора копируются без знака.
                        </span>
                    </div>
                </>
            )}
        </div>
    );
};

export default MarkForm;
