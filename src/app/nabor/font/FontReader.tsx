'use client';
import { useState } from "react";
import { readFont, type FontInfo } from "@/lib/csEncoding/font";
import { coverageOf, missingFor, puaOf, verdictOf, type Verdict } from "@/lib/csEncoding/fontReport";
import { charInfo } from "@/lib/csEncoding/chars";

// Разбор шрифтового файла. Читается в браузере целиком: файл никуда не уходит,
// и это важно — чужой шрифт часто не выложен и распространять его нельзя.
//
// ⚠️ Всякий fetch, добавленный сюда, делает ложью строку на странице.

/** Больше не бывает: самый крупный из здешних — 500 КБ, толстые CJK — до 30 МБ. */
const MAX_BYTES = 40 * 1024 * 1024;

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

const KIND_COLORS: Record<Verdict["kind"], string> = {
    "unicode-cs": "border-slate-300",
    "unicode-general": "border-amber-300",
    "ucs-layout": "border-amber-300",
    legacy: "border-amber-300",
};

const FontReader = () => {
    const [font, setFont] = useState<FontInfo | null>(null);
    const [fileName, setFileName] = useState("");
    const [error, setError] = useState("");
    const [sample, setSample] = useState("");

    const onFile = (file: File | undefined) => {
        setError("");
        if (!file) return;
        if (file.size > MAX_BYTES) {
            setError(`Файл больше сорока мегабайт (${(file.size / 1024 / 1024).toFixed(1)} МБ).`);
            return;
        }
        file.arrayBuffer().then((buffer) => {
            try {
                setFont(readFont(buffer));
                setFileName(file.name);
            } catch (e) {
                setFont(null);
                setError(e instanceof Error ? e.message : "Файл не разобрался.");
            }
        });
    };

    const verdict = font && verdictOf(font);
    const coverage = font && coverageOf(font);
    const pua = font && puaOf(font);
    const gaps = font && sample ? missingFor(font, sample) : [];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <input
                    type="file"
                    accept=".ttf,.otf,.woff,font/ttf,font/otf"
                    aria-label="Шрифтовой файл"
                    onChange={(e) => onFile(e.target.files?.[0])}
                    className="font-serif text-sm"
                />
                <p className="font-serif text-xs text-slate-500">
                    Читается сам файл — то, что в нём объявлено, а не то, что нарисовал браузер.
                    Файл остаётся у вас: на сервер он не уходит.
                </p>
                {error && <p className="font-serif text-sm text-red-700">{error}</p>}
            </div>

            {font && verdict && (
                <>
                    <div className={`border-l-2 pl-3 py-1 ${KIND_COLORS[verdict.kind]}`}>
                        <p className="font-serif text-slate-800">
                            <strong>{verdict.title}</strong>
                        </p>
                        <p className="font-serif text-sm text-slate-600 mt-1">
                            {[font.names.family, font.names.subfamily].filter(Boolean).join(", ") || fileName}
                            {font.names.version ? ` · ${font.names.version}` : ""}
                            {` · ${font.format === "cff" ? "очертания CFF (OpenType)" : "очертания TrueType"}`}
                            {` · глифов ${font.glyphCount.toLocaleString("ru")}, знаков ${font.codepoints.size.toLocaleString("ru")}`}
                        </p>
                        <ul className="font-serif text-xs text-slate-500 list-disc pl-5 mt-1">
                            {verdict.why.map((w) => <li key={w}>{w}</li>)}
                        </ul>
                        {verdict.warnings.map((w) => (
                            <p key={w} className="font-serif text-sm text-amber-700 mt-1">{w}</p>
                        ))}
                    </div>

                    <section>
                        <h3 className="font-serif font-bold text-sm">Покрытие по разрядам</h3>
                        <ul className="mt-1 flex flex-col gap-1">
                            {coverage!.map(({ group, have, missing }) => (
                                <li key={group.name} className="font-serif text-sm">
                                    <span className={missing.length ? "text-amber-800" : "text-slate-700"}>
                                        {group.name}: {have} из {group.codes.length}
                                    </span>
                                    <span className="text-slate-500 text-xs"> — {group.note}</span>
                                    {missing.length > 0 && missing.length <= 12 && (
                                        <div className="text-xs text-slate-500">
                                            нет: {missing.map((cp) => `${hex(cp)} ${charInfo(cp).name}`).join(", ")}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-sm">Разметка</h3>
                        <p className="font-serif text-sm text-slate-700 mt-1">
                            Привязка знака к букве: <strong>{font.layout.markToBase ? "есть" : "нет"}</strong>;
                            знака к знаку: <strong>{font.layout.markToMark ? "есть" : "нет"}</strong>.
                            {font.layout.features.length > 0 && (
                                <> Объявленные возможности: <span className="font-mono text-xs">
                                    {font.layout.features.join(", ")}</span>.</>
                            )}
                        </p>
                        <p className="font-serif text-xs text-slate-500 mt-1">
                            Привязка — то, чем церковнославянский шрифт отличается от обычного, где
                            нужные глифы нашлись случайно: без неё надстрочный знак встаёт отдельной
                            литерой.
                        </p>
                    </section>

                    {pua && (pua.known.length > 0 || pua.unknown.length > 0) && (
                        <section>
                            <h3 className="font-serif font-bold text-sm">Частная область</h3>
                            <p className="font-serif text-sm text-slate-700 mt-1">
                                Объявлено кодов: {(pua.known.length + pua.unknown.length).toLocaleString("ru")};
                                из них соглашению известны {pua.known.length}.
                            </p>
                            {pua.known.length > 0 && (
                                <ul className="font-serif text-xs text-slate-500 mt-1 flex flex-col gap-0.5">
                                    {pua.known.slice(0, 8).map((e) => (
                                        <li key={e.cp}>{hex(e.cp)} — {e.name}</li>
                                    ))}
                                    {pua.known.length > 8 && <li>…и ещё {pua.known.length - 8}</li>}
                                </ul>
                            )}
                        </section>
                    )}

                    <section>
                        <h3 className="font-serif font-bold text-sm">Хватит ли шрифта на ваш текст</h3>
                        <textarea
                            rows={3}
                            value={sample}
                            onChange={(e) => setSample(e.target.value.slice(0, 50_000))}
                            placeholder="Вставьте текст, который собираетесь набирать этим шрифтом"
                            aria-label="Текст для проверки"
                            className="font-serif font-sans-serif border border-slate-300 rounded p-2 w-full mt-1"
                        />
                        {sample && (
                            gaps.length === 0 ? (
                                <p className="font-serif text-sm text-slate-700">
                                    Все знаки текста в шрифте есть.
                                </p>
                            ) : (
                                <div>
                                    <p className="font-serif text-sm text-amber-700">
                                        Не хватает знаков: {gaps.length}.
                                    </p>
                                    <ul className="font-serif text-xs text-slate-600 mt-1 flex flex-col gap-0.5">
                                        {gaps.slice(0, 20).map((g) => (
                                            <li key={g.cp}>
                                                {hex(g.cp)} {g.name}
                                                <span className="text-slate-400"> — {g.count} в тексте</span>
                                            </li>
                                        ))}
                                        {gaps.length > 20 && <li>…и ещё {gaps.length - 20}</li>}
                                    </ul>
                                </div>
                            )
                        )}
                    </section>

                    {(font.names.license || font.names.licenseUrl) && (
                        <section>
                            <h3 className="font-serif font-bold text-sm">Условия распространения</h3>
                            <p className="font-serif text-xs text-slate-600 mt-1">
                                {font.names.licenseUrl ?? ""}
                                {font.names.license ? ` ${font.names.license.slice(0, 300)}` : ""}
                            </p>
                        </section>
                    )}
                </>
            )}
        </div>
    );
};

export default FontReader;
