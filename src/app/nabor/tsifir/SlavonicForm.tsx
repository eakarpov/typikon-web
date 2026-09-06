'use client';
import { useState } from "react";
import type { ConvertResult, CslToken, CslVariant } from "@/lib/cslav/convert";
import { CASE_LABELS } from "@/lib/cslav/labels";
import { plural } from "@/utils/plural";

// Гражданка в церковнославянское написание.
//
// ⚠️ Единственная форма раздела, которая отправляет текст на сервер: указатель
// написаний живёт в базе, и в браузер его не увезти. Сказано это на самой
// странице, и убирать оттуда нельзя.
//
// Устройство спорного места — то же, что у разметки ударений (@/app/accents):
// написание не выбирается молча, а показывается списком, и выбор человека
// живёт отдельно от разметки, в `chosen`.

const MAX_LENGTH = 20_000;

const SAMPLE = "Господи, воззвах к тебе, услыши мя";

const RULE_LABELS: Record<string, string> = {
    "юс": "юс вместо я",
    "ук": "ук вместо у",
    "ер": "конечный ер",
    "звательце": "звательце",
    "от": "приставка ѿ",
};

const SOURCE_LABELS: Record<string, string> = {
    corpus: "по собранию",
    lexicon: "по словарю",
    bible: "по Библии",
    rule: "по правилу",
};

const Variant = ({ variant }: { variant: CslVariant }) => (
    <>
        <span className="font-sans-serif">{variant.applied}</span>
        <span className="text-slate-500">
            {variant.properties ? ` — ${CASE_LABELS(variant.properties)}` : ""}
            {variant.count > 0
                ? `, ${variant.count} ${plural(variant.count, "раз", "раза", "раз")}`
                    + (variant.texts
                        ? ` в ${variant.texts} ${plural(variant.texts, "тексте", "текстах", "текстах")}`
                        : "")
                : `, ${SOURCE_LABELS[variant.source]}`}
        </span>
    </>
);

const Ambiguous = ({ token, chosen, onChoose }: {
    token: CslToken;
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
                className={`font-sans-serif underline decoration-dotted underline-offset-4 ${
                    chosen ? "decoration-amber-700" : "bg-amber-100 decoration-amber-800"}`}
                title="Написаний несколько — выберите"
            >
                {chosen ?? token.text}
            </button>
            {open && (
                <span className="absolute z-10 left-0 top-full mt-1 flex flex-col border border-slate-300
                                 rounded bg-white shadow min-w-max">
                    {token.variants?.map((variant) => (
                        <button
                            key={variant.applied + variant.source}
                            type="button"
                            onClick={() => { onChoose(variant.applied); setOpen(false); }}
                            className={`text-left px-2 py-1 text-sm hover:bg-amber-50 ${
                                chosen === variant.applied ? "font-bold text-amber-800" : ""}`}
                        >
                            <Variant variant={variant} />
                        </button>
                    ))}
                </span>
            )}
        </span>
    );
};

const Word = ({ token, chosen, onChoose }: {
    token: CslToken;
    chosen?: string;
    onChoose: (applied: string | undefined) => void;
}) => {
    if (token.kind === "plain") return <>{token.text}</>;
    if (token.kind === "ambiguous") return <Ambiguous token={token} chosen={chosen} onChoose={onChoose} />;
    if (token.kind === "byRule") {
        return (
            <span
                className="font-sans-serif underline decoration-dotted underline-offset-4 decoration-slate-400"
                title={"По правилу: указателю это слово неизвестно. Дописано: "
                    + `${token.rules?.map((r) => RULE_LABELS[r] ?? r).join(", ")}. `
                    + "Ять, омега и і при этом не восстановлены"}
            >
                {token.text}
            </span>
        );
    }
    if (token.kind === "untouched") {
        return <span className="text-slate-500" title={token.why}>{token.text}</span>;
    }
    return <span className="font-sans-serif">{token.text}</span>;
};

const SlavonicForm = () => {
    const [text, setText] = useState("");
    const [rule, setRule] = useState(true);
    const [result, setResult] = useState<ConvertResult | null>(null);
    const [chosen, setChosen] = useState<Record<number, string>>({});
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    const convert = async (value = text, withRule = rule) => {
        if (!value.trim()) return;
        setBusy(true);
        setError("");
        try {
            const response = await fetch("/api/cslav/convert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: value, rule: withRule }),
            });
            const data = await response.json();
            if (!response.ok) { setError(data.error ?? "Не вышло"); setResult(null); }
            else { setResult(data); setChosen({}); setCopied(false); }
        } catch {
            setError("Сервер не ответил");
        } finally {
            setBusy(false);
        }
    };

    const plain = result
        ? result.tokens.map((token, index) => chosen[index] ?? token.text).join("")
        : "";

    return (
        <div className="flex flex-col gap-3">
            <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
                placeholder={SAMPLE}
                aria-label="Гражданский текст"
                className="font-serif border border-slate-300 rounded p-2 w-full"
            />

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => convert()}
                    disabled={busy || !text.trim()}
                    className="font-serif border border-slate-300 rounded px-3 py-1 bg-slate-50
                               hover:bg-slate-100 disabled:opacity-50"
                >
                    {busy ? "Перевожу…" : "Перевести"}
                </button>
                <button
                    type="button"
                    onClick={() => { setText(SAMPLE); convert(SAMPLE); }}
                    className="font-serif text-sm border border-slate-300 rounded px-3 py-1
                               bg-slate-50 hover:bg-slate-100"
                >
                    подставить пример
                </button>
                <label className="font-serif text-sm text-slate-600 flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={rule}
                        onChange={(e) => { setRule(e.target.checked); if (result) convert(text, e.target.checked); }}
                    />
                    дописывать по правилу
                </label>
            </div>

            {error && <p className="font-serif text-sm text-red-700">{error}</p>}

            {result && (
                <>
                    <p className="font-serif text-lg leading-relaxed whitespace-pre-wrap
                                  border border-slate-200 rounded p-2">
                        {result.tokens.map((token, index) => (
                            <Word
                                key={index}
                                token={token}
                                chosen={chosen[index]}
                                onChoose={(applied) => setChosen((was) => {
                                    const next = { ...was };
                                    if (applied === undefined) delete next[index]; else next[index] = applied;
                                    return next;
                                })}
                            />
                        ))}
                    </p>

                    <p className="font-serif text-sm text-slate-600">
                        Переведено {result.byDictionary + result.byRule + result.ambiguous} из {result.expected}
                        {": "}по словарю {result.byDictionary}
                        {result.byRule > 0 && <>, по правилу {result.byRule}</>}
                        {result.ambiguous > 0 && <>, спорных {result.ambiguous} — нажмите, чтобы выбрать</>}
                        {result.untouched > 0 && <>. Не тронуто {result.untouched}</>}
                    </p>

                    <div>
                        <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(plain).then(() => setCopied(true))}
                            className="font-serif text-sm border border-slate-300 rounded px-3 py-1
                                       bg-slate-50 hover:bg-slate-100"
                        >
                            {copied ? "Скопировано" : "Скопировать"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default SlavonicForm;
