'use client';
import { useMemo, useState } from "react";
import { inspect, FLAG_LABELS, FLAG_NOTES, type Cluster, type ClusterFlag } from "@/lib/csEncoding/inspect";
import { CLASS_LABELS } from "@/lib/csEncoding/chars";

// Разбор строки по знакам. Считается в браузере: словарь на 118 записей и
// проход по строке — ходить за этим на сервер незачем.

const MAX_LENGTH = 4_000;

const SAMPLE = "Влады́ко гдⷭѣ, бж҃е нашъ, оу҆слы́ши мл҃твꙋ мою̀";

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

const Flag = ({ flag }: { flag: ClusterFlag }) => (
    <span
        title={FLAG_NOTES[flag]}
        className="text-[11px] px-1.5 py-0.5 rounded font-serif bg-amber-100 text-amber-800"
    >
        {FLAG_LABELS[flag]}
    </span>
);

const Row = ({ cluster }: { cluster: Cluster }) => (
    <li className={`border-l-2 pl-3 py-1 ${cluster.flags.length ? "border-amber-300" : "border-slate-200"}`}>
        <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-serif font-sans-serif text-2xl">{cluster.text}</span>
            <span className="font-serif text-sm text-slate-700">
                {[cluster.base, ...cluster.marks]
                    .map((c) => `${hex(c.cp)} ${c.name}`)
                    .join(" · ")}
            </span>
            {cluster.flags.map((f) => <Flag key={f} flag={f} />)}
        </div>
        <p className="font-serif text-xs text-slate-500">
            {[cluster.base, ...cluster.marks].map((c) => CLASS_LABELS[c.klass]).join(", ")}
            {cluster.base.note ? ` · ${cluster.base.note}` : ""}
        </p>
    </li>
);

const Inspector = () => {
    const [text, setText] = useState("");
    const [copied, setCopied] = useState(false);
    const result = useMemo(() => (text ? inspect(text.slice(0, MAX_LENGTH)) : null), [text]);

    const asText = () => (result?.clusters ?? [])
        .map((c) => [c.base, ...c.marks].map((x) => `${hex(x.cp)} ${x.name}`).join(" · ")
            + (c.flags.length ? ` — ${c.flags.map((f) => FLAG_LABELS[f]).join(", ")}` : ""))
        .join("\n");

    return (
        <div className="flex flex-col gap-3">
            <textarea
                rows={3}
                value={text}
                onChange={(e) => { setText(e.target.value.slice(0, MAX_LENGTH)); setCopied(false); }}
                placeholder={SAMPLE}
                aria-label="Строка для разбора"
                className="font-serif font-sans-serif border border-slate-300 rounded p-2 w-full text-lg"
            />
            <div>
                <button
                    type="button"
                    onClick={() => setText(SAMPLE)}
                    className="font-serif text-sm border border-slate-300 rounded px-3 py-1 bg-slate-50 hover:bg-slate-100"
                >
                    подставить пример
                </button>
            </div>

            {result && result.summary.length > 0 && (
                <div className="border-l-2 border-amber-300 pl-3 py-1">
                    <p className="font-serif text-slate-800">Замечено:</p>
                    <ul className="font-serif text-sm text-slate-700 mt-1 flex flex-col gap-0.5">
                        {result.summary.map(({ flag, count }) => (
                            <li key={flag}>
                                <strong>{FLAG_LABELS[flag]}</strong> — {count} {count === 1 ? "раз" : "раза"}
                                {": "}{FLAG_NOTES[flag]}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {result && result.clusters.length > 0 && (
                <>
                    {/* Пометы — не приговор: разночтения изданий тоже попадают
                        сюда, и сказано об этом в самой подписи каждой. */}
                    <ul className="flex flex-col gap-0.5 max-h-[32rem] overflow-auto">
                        {result.clusters.map((c, i) => <Row key={`${c.text}-${i}`} cluster={c} />)}
                    </ul>
                    <div>
                        <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(asText()).then(() => setCopied(true))}
                            className="font-serif text-sm border border-slate-300 rounded px-3 py-1 bg-slate-50 hover:bg-slate-100"
                        >
                            {copied ? "Скопировано" : "Скопировать разбор текстом"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default Inspector;
