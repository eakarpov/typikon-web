'use client';
import { useMemo, useState } from "react";
// @ts-ignore — у file-saver нет типов; так же он подключён в components/save/TextSave.
import { saveAs } from "file-saver";
import { foldPua, PUA_BY_CODE } from "@/lib/csEncoding/pua";
import { encodeText, MIME, OUT_LABELS, OUT_NOTES, type OutEncoding } from "@/lib/csEncoding/download";

// Сведение частных кодов к юникоду. Считается в браузере: таблица на два десятка
// записей и проход по строке.
//
// ⚠️ Всякий fetch, добавленный сюда, делает ложью строку на странице о том, что
// текст никуда не уходит, — и правится тогда сперва страница.

const MAX_LENGTH = 100_000;

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

const nameOf = (cp: number) => PUA_BY_CODE[cp]?.name ?? "неизвестный знак";

const Folder = () => {
    const [text, setText] = useState("");
    const [letters, setLetters] = useState(false);
    const [encoding, setEncoding] = useState<OutEncoding>("utf-8-bom");
    const [copied, setCopied] = useState(false);

    const result = useMemo(() => (text ? foldPua(text, { letters }) : null), [text, letters]);
    const folded = result ? Object.entries(result.folded) : [];
    const kept = result ? Object.entries(result.kept) : [];

    return (
        <div className="flex flex-col gap-3">
            <textarea
                rows={5}
                value={text}
                onChange={(e) => { setText(e.target.value.slice(0, MAX_LENGTH)); setCopied(false); }}
                placeholder="Вставьте церковнославянский текст, набранный шрифтом семейства Ponomar"
                aria-label="Текст с частными кодами"
                className="font-serif font-sans-serif border border-slate-300 rounded p-2 w-full text-lg"
            />

            <label className="font-serif text-sm text-slate-700 flex items-start gap-2">
                <input type="checkbox" checked={letters} onChange={(e) => setLetters(e.target.checked)} className="mt-1" />
                <span>
                    сводить и варианты начертаний (ять короткая → ѣ, ук короткий → ꙋ).{" "}
                    <span className="text-slate-500">
                        Рисунок буквы при этом теряется: для воспроизведения издания различие
                        значимо, для поиска и переносимости — мешает.
                    </span>
                </span>
            </label>

            {result && (
                <>
                    {folded.length === 0 && kept.length === 0 && (
                        <p className="font-serif text-sm text-slate-600">
                            Частных кодов в тексте нет — сводить нечего.
                        </p>
                    )}

                    {folded.length > 0 && (
                        <div>
                            <h3 className="font-serif font-bold text-sm mb-1">Вышло</h3>
                            <p className="font-serif font-sans-serif border border-slate-200 rounded p-2
                                          whitespace-pre-wrap text-lg max-h-72 overflow-auto">
                                {result.text}
                            </p>
                        </div>
                    )}

                    {folded.length > 0 && (
                        <div>
                            <p className="font-serif text-sm text-slate-700">Сведено:</p>
                            <ul className="font-serif text-sm text-slate-600 mt-1 flex flex-col gap-0.5">
                                {folded.sort((a, b) => b[1] - a[1]).map(([cp, n]) => {
                                    const entry = PUA_BY_CODE[Number(cp)];
                                    return (
                                        <li key={cp}>
                                            {hex(Number(cp))} {nameOf(Number(cp))} → {entry?.to}{" "}
                                            <span className="text-slate-400">
                                                ({n} {n === 1 ? "раз" : "раза"}; {entry?.evidence})
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {kept.length > 0 && (
                        <div>
                            {/* Оставленное называется поимённо: молчание о нём читалось бы
                                как «здесь всё сведено», а это не так. */}
                            <p className="font-serif text-sm text-slate-700">Оставлено как было:</p>
                            <ul className="font-serif text-sm text-slate-600 mt-1 flex flex-col gap-0.5">
                                {kept.sort((a, b) => b[1] - a[1]).map(([cp, n]) => {
                                    const entry = PUA_BY_CODE[Number(cp)];
                                    return (
                                        <li key={cp}>
                                            {hex(Number(cp))} {nameOf(Number(cp))}{" "}
                                            <span className="text-slate-400">
                                                ({n} {n === 1 ? "раз" : "раза"};{" "}
                                                {!entry ? "соглашению неизвестен"
                                                    : entry.kind === "unknown" ? "юникодного соответствия нет"
                                                        : "вариант начертания — сводится по отдельному выбору"})
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {folded.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigator.clipboard?.writeText(result.text).then(() => setCopied(true))}
                                className="font-serif border border-slate-300 rounded px-3 py-1 bg-slate-50 hover:bg-slate-100"
                            >
                                {copied ? "Скопировано" : "Скопировать"}
                            </button>
                            <select
                                value={encoding}
                                onChange={(e) => setEncoding(e.target.value as OutEncoding)}
                                aria-label="Кодировка файла"
                                className="font-serif border border-slate-300 rounded px-2 py-1"
                            >
                                {(Object.keys(OUT_LABELS) as OutEncoding[]).map((e) => (
                                    <option key={e} value={e}>{OUT_LABELS[e]}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => saveAs(
                                    new Blob([encodeText(result.text, encoding).slice().buffer as ArrayBuffer],
                                        { type: MIME[encoding] }),
                                    "svedeno.txt",
                                )}
                                className="font-serif border border-slate-300 rounded px-3 py-1 bg-slate-50 hover:bg-slate-100"
                            >
                                Скачать файлом
                            </button>
                            <span className="font-serif text-xs text-slate-500">{OUT_NOTES[encoding]}</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Folder;
