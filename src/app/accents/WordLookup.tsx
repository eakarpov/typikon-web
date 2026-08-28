'use client';
import React, { useCallback, useState } from "react";
import Link from "next/link";
import type { AccentAnswer } from "@/lib/accents/core";

// Справка по одному слову: что говорит каждый из трёх источников.
//
// Показываем все три и не сводим их к одному ответу. Разница между ними —
// не шум: «спасе» в чтениях аорист «спасе́», в песнопениях звательный «спа́се»,
// а словарь объясняет, отчего так («спасти́» aor. против «спа́съ» sg.voc).

const Rows = ({ title, note, rows }: {
    title: string;
    note: string;
    rows: { spelling: string; count: number; share?: number; extra?: string }[];
}) => {
    if (!rows.length) {
        return (
            <div>
                <p className="font-serif font-bold">{title}</p>
                <p className="font-serif text-sm text-slate-500">не встречается</p>
            </div>
        );
    }

    return (
        <div>
            <p className="font-serif font-bold">{title}</p>
            <p className="font-serif text-xs text-slate-500 mb-1">{note}</p>
            <ul className="flex flex-col gap-0.5">
                {rows.map((row) => (
                    <li key={row.spelling + (row.extra ?? "")} className="font-serif">
                        <span className="text-lg">{row.spelling}</span>
                        <span className="text-sm text-slate-500">
                            {" — "}{row.count}
                            {row.share !== undefined && `, ${Math.round(row.share * 100)}%`}
                            {row.extra && `, ${row.extra}`}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const WordLookup = () => {
    const [value, setValue] = useState("");
    const [answer, setAnswer] = useState<AccentAnswer | null>(null);
    const [busy, setBusy] = useState(false);

    const look = useCallback(async () => {
        const word = value.trim();
        if (!word) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/v2/accents/${encodeURIComponent(word)}`);
            setAnswer(await res.json());
        } catch {
            setAnswer(null);
        } finally {
            setBusy(false);
        }
    }, [value]);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-row flex-wrap items-center gap-2">
                <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void look(); }}
                    placeholder="земли"
                    className="font-serif border border-slate-300 rounded px-2 py-1"
                />
                <button
                    type="button"
                    onClick={look}
                    disabled={busy || !value.trim()}
                    className="font-serif border border-slate-300 rounded px-3 py-1 disabled:opacity-50"
                >
                    Найти
                </button>
                <span className="font-serif text-sm text-slate-500">
                    Можно с ударениями и в церковнославянской графике.
                </span>
            </div>

            {answer && !answer.known && (
                <p className="font-serif">
                    Слова «{answer.word}» нет ни в одном источнике. Это обычное дело для имён
                    собственных и редких форм.
                </p>
            )}

            {answer?.known && (
                <div className="flex flex-col gap-3">
                    {answer.agree === false && (
                        <p className="font-serif text-sm text-slate-600">
                            Источники ставят ударение на разные гласные. Это не обязательно ошибка:
                            «зе́мли» (мн. им.) и «землѝ» (ед. род.) без знаков пишутся одинаково.
                        </p>
                    )}

                    <div className="grid gap-4 md:grid-cols-3">
                        <Rows
                            title="В чтениях"
                            note="Пролог, Златоуст, жития — прозаические книги"
                            rows={answer.corpus.map((v) => ({ spelling: v.spelling, count: v.count, share: v.share }))}
                        />
                        <Rows
                            title="В песнопениях"
                            note="Октоих, Минеи, Триоди, Часослов"
                            rows={answer.chants.map((v) => ({ spelling: v.spelling, count: v.count, share: v.share }))}
                        />
                        <Rows
                            title="В словаре"
                            note="Порождено по парадигме, частот нет"
                            rows={answer.lexicon.map((v) => ({
                                spelling: v.spelling,
                                count: v.forms,
                                extra: [v.lexeme, v.properties].filter(Boolean).join(" "),
                            }))}
                        />
                    </div>

                    {!!answer.lexicon.length && (
                        <p className="font-serif text-sm">
                            <Link
                                href={`/dictionary?query=${encodeURIComponent(answer.lexicon[0].lexeme)}`}
                                className="text-amber-800 hover:underline"
                            >
                                Склонение слова «{answer.lexicon[0].lexeme}» в словаре
                            </Link>
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default WordLookup;
