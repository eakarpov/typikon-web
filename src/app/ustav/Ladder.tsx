'use client';
import React, { useCallback, useState } from "react";
import type { OrdoRule } from "@/lib/ordo";

// «Лестница правил» — какие файлы сложили именно эту выдачу: канва службы и
// развёрнутые ею блоки, слои устава по цепочке наследования, календарные главы
// Типикона, свой словарь формул.
//
// Не украшение. Собранная служба без «откуда» непроверяема: сказать, верна ли
// она, можно только заглянув в правило, которое её так сложило.

const Ladder = ({ rules }: { rules: OrdoRule[] }) => {
    const [open, setOpen] = useState<string | null>(null);
    const [texts, setTexts] = useState<Record<string, string>>({});

    const toggle = useCallback(async (path: string) => {
        if (open === path) { setOpen(null); return; }
        setOpen(path);
        if (texts[path]) return;
        try {
            const res = await fetch(`/api/ordo/rule?path=${encodeURIComponent(path)}`);
            const data = await res.json();
            setTexts(prev => ({ ...prev, [path]: data.text ?? data.error ?? "не прочиталось" }));
        } catch {
            setTexts(prev => ({ ...prev, [path]: "не прочиталось" }));
        }
    }, [open, texts]);

    if (!rules.length) return null;

    return (
        <div className="text-sm">
            <div className="font-serif text-slate-500 mb-1">Правила, сложившие эту службу</div>
            <ol className="flex flex-col gap-0.5">
                {rules.map(rule => (
                    <li key={rule.path}>
                        <button
                            onClick={() => toggle(rule.path)}
                            className="text-left font-serif hover:text-red-900"
                            title={rule.path}
                        >
                            <span className="text-[10px] text-slate-400 mr-1">{rule.kind}</span>
                            {rule.label}
                            {rule.note && <span className="text-slate-400"> — {rule.note}</span>}
                        </button>
                        {open === rule.path && (
                            <pre className="text-[11px] bg-slate-50 border rounded p-2 mt-1 overflow-x-auto whitespace-pre">
                                {texts[rule.path] ?? "…"}
                            </pre>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
};

export default Ladder;
