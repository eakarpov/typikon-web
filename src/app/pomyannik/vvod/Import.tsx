'use client';
import React from "react";
import { useRouter } from "next/navigation";
import type { PersonKind } from "@/lib/pomyannik/types";
import type { NameCheck } from "@/lib/pomyannik/names";
import type { ParsedLine } from "@/lib/pomyannik/parse";
import { humanDate, rankLabel } from "@/app/pomyannik/labels";

// РАЗБОР ПОКАЗЫВАЕТСЯ ПРЕЖДЕ ЗАПИСИ.
//
// Человек переписывает помянник с бумажного разворота — тридцать строк разом, —
// и увидеть, что мы поняли, он должен ДО того, как это ляжет в базу. Иначе
// разбор придётся чинить по одному имени, а это ровно та работа, от которой
// массовый ввод и избавляет.
//
// ПОДСКАЗКА НЕ ПРИМЕНЯЕТСЯ САМА. «Юрий → Георгий» стоит рядом со строкой
// кнопкой: имя наречения — дело крещения, а не словаря, и подменять его молча
// значит решать за человека, кем его крестили.

const BUTTON = "border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100 font-serif text-sm";

interface Line extends ParsedLine {
    check: NameCheck | null;
    duplicate: boolean;
}

const EXAMPLE = `о здравии
Николай
Мария, мл.
Георгий, болящий, р.14.06.1978

о упокоении
Иоанн, †12.03.2019
Пётр, воин`;

const Import = () => {
    const router = useRouter();
    const [text, setText] = React.useState("");
    const [kind, setKind] = React.useState<PersonKind>("living");
    const [lines, setLines] = React.useState<Line[] | null>(null);
    const [chosen, setChosen] = React.useState<Record<number, string>>({});
    const [skip, setSkip] = React.useState<Record<number, boolean>>({});
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const parse = async () => {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/pomyannik/parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, kind }),
            });
            if (!response.ok) { setError("не удалось разобрать список"); return; }
            const body = await response.json();
            setLines(body.lines.filter((l: Line) => l.person));
            setChosen({});
            setSkip({});
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        if (!lines) return;
        setBusy(true);
        setError(null);
        try {
            const persons = lines
                .filter(line => line.person && !skip[line.line])
                .map(line => ({
                    ...line.person!,
                    // Церковное имя кладём отдельным полем: написанное человеком
                    // остаётся при нём, а поминают по церковному.
                    churchName: chosen[line.line] ?? line.person!.churchName ?? null,
                }));
            if (!persons.length) { setError("нечего записывать"); return; }

            const response = await fetch("/api/pomyannik", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ persons }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                setError(body?.error ?? "не удалось записать");
                return;
            }
            router.push("/pomyannik");
            router.refresh();
        } finally {
            setBusy(false);
        }
    };

    if (lines) {
        const willSave = lines.filter(l => !skip[l.line]).length;
        return (
            <div className="flex flex-col gap-4">
                <p className="font-serif text-sm text-slate-600">
                    Вот что мы поняли. Поправьте, что нужно, и запишите — до этого в помянник
                    ничего не попало.
                </p>

                <table className="font-serif text-sm border-collapse">
                    <thead>
                        <tr className="text-left text-slate-500 border-b">
                            <th className="py-1 pr-3 font-normal">имя</th>
                            <th className="py-1 pr-3 font-normal">раздел</th>
                            <th className="py-1 pr-3 font-normal">помета и даты</th>
                            <th className="py-1 font-normal">что скажем</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map(line => {
                            const person = line.person!;
                            const church = chosen[line.line];
                            const off = skip[line.line];
                            return (
                                <tr key={line.line}
                                    className={`border-b border-slate-100 align-top ${off ? "opacity-40" : ""}`}>
                                    <td className="py-1 pr-3">
                                        {church ? (
                                            <>
                                                <span className="text-slate-800">{church}</span>{" "}
                                                <span className="text-slate-400">({person.name})</span>
                                            </>
                                        ) : person.name}
                                    </td>
                                    <td className="py-1 pr-3 text-slate-600">
                                        {person.kind === "departed" ? "о упокоении" : "о здравии"}
                                    </td>
                                    <td className="py-1 pr-3 text-slate-600">
                                        {[
                                            rankLabel(person.rank ?? null, person.sex ?? null),
                                            person.born ? `р. ${humanDate(person.born)}` : "",
                                            person.died ? `† ${humanDate(person.died)}` : "",
                                            person.relation ?? "",
                                        ].filter(Boolean).join(", ") || "—"}
                                    </td>
                                    <td className="py-1">
                                        {line.check?.status === "civil" && !church && (
                                            <span className="text-amber-700">
                                                в святцах это имя пишется иначе:{" "}
                                                {line.check.suggestions.map(s => (
                                                    <button key={s.name} type="button"
                                                            title={s.why}
                                                            onClick={() => setChosen(c => ({ ...c, [line.line]: s.name }))}
                                                            className="underline hover:text-red-900 mr-2">
                                                        {s.name}
                                                    </button>
                                                ))}
                                            </span>
                                        )}
                                        {line.check?.status === "unknown" && line.check.suggestions.length > 0 && (
                                            <span className="text-amber-700">
                                                может быть,{" "}
                                                <button type="button"
                                                        onClick={() => setChosen(c => ({ ...c, [line.line]: line.check!.suggestions[0].name }))}
                                                        className="underline hover:text-red-900">
                                                    {line.check.suggestions[0].name}
                                                </button>?
                                            </span>
                                        )}
                                        {line.check?.status === "unknown" && !line.check.suggestions.length && (
                                            <span className="text-slate-500">
                                                имени нет в наших святцах — запишем как есть
                                            </span>
                                        )}
                                        {line.duplicate && (
                                            <span className="text-slate-500"> · такое имя уже есть</span>
                                        )}
                                        {church && (
                                            <button type="button"
                                                    onClick={() => setChosen(({ [line.line]: _, ...rest }) => rest)}
                                                    className="text-slate-400 underline hover:text-red-900">
                                                вернуть своё написание
                                            </button>
                                        )}
                                        {line.unparsed.length > 0 && (
                                            <span className="text-amber-700">
                                                не поняли: {line.unparsed.join("; ")}
                                            </span>
                                        )}
                                        <button type="button"
                                                onClick={() => setSkip(s => ({ ...s, [line.line]: !off }))}
                                                className="text-slate-400 underline hover:text-red-900 ml-2">
                                            {off ? "вернуть" : "не записывать"}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {error && <p className="font-serif text-sm text-amber-700">{error}</p>}

                <div className="flex gap-3">
                    <button className={BUTTON} onClick={save} disabled={busy || !willSave}>
                        записать {willSave}
                    </button>
                    <button className={BUTTON} onClick={() => setLines(null)} disabled={busy}>
                        вернуться к списку
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3 items-center font-serif text-sm">
                <span className="text-slate-600">без заголовка считать именами</span>
                {(["living", "departed"] as PersonKind[]).map(value => (
                    <label key={value} className="flex gap-1 items-center">
                        <input type="radio" name="kind" checked={kind === value}
                               onChange={() => setKind(value)} />
                        {value === "living" ? "о здравии" : "о упокоении"}
                    </label>
                ))}
            </div>

            {/* Высота задана `rows`, а не классом: в нашем Tailwind 3.2 шкалы
                min-h-* с числами ещё нет, и `min-h-64` не давал ничего — поле
                оставалось в одну строку, а списком в него вводят три десятка */}
            <textarea
                rows={14}
                className="border rounded px-2 py-1 font-serif bg-white text-sm w-full"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={EXAMPLE}
                spellCheck={false}
            />

            <div className="flex gap-3">
                <button className={BUTTON} onClick={parse} disabled={busy || !text.trim()}>
                    разобрать
                </button>
                {!text.trim() && (
                    <button type="button" className={BUTTON} onClick={() => setText(EXAMPLE)}>
                        подставить пример
                    </button>
                )}
            </div>
            {error && <p className="font-serif text-sm text-amber-700">{error}</p>}
        </div>
    );
};

export default Import;
