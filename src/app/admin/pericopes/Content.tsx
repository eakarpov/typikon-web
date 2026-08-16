"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BIBLE_BOOK_SLUG_OPTIONS } from "@/utils/texts";
import { parseVerseRanges, IVerseRange } from "@/utils/verses";

interface IPericope {
    id: string;
    source: "gospel" | "apostle";
    bookSlug: string;
    number: number;
    variant: string | null;
    label: string;
    occasions: string[];
    ranges: IVerseRange[];
}

const formatRanges = (ranges: IVerseRange[]): string =>
    ranges.map(r => `${r.chapterFrom}:${r.verseFrom}-${r.chapterTo}:${r.verseTo}`).join(",");

interface IEditFormState {
    label: string;
    bookSlug: string;
    number: string;
    variant: string;
    occasions: string;
    rangesText: string;
}

const toFormState = (p: IPericope): IEditFormState => ({
    label: p.label,
    bookSlug: p.bookSlug,
    number: String(p.number),
    variant: p.variant || "",
    occasions: p.occasions.join("; "),
    rangesText: formatRanges(p.ranges),
});

const PericopeRow = ({ pericope, onSaved, onDeleted }: {
    pericope: IPericope;
    onSaved: (updated: IPericope) => void;
    onDeleted: (id: string) => void;
}) => {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<IEditFormState>(() => toFormState(pericope));
    const [saving, setSaving] = useState(false);

    const onOpenEdit = useCallback(() => {
        setForm(toFormState(pericope));
        setEditing(true);
    }, [pericope]);

    const onSave = useCallback(() => {
        const ranges = parseVerseRanges(form.rangesText);
        if (ranges.length === 0) {
            alert("Не удалось распознать диапазоны. Формат: 1:1-1:25,4:25-5:12");
            return;
        }
        setSaving(true);
        fetch(`/api/admin/pericopes/${pericope.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                source: pericope.source,
                bookSlug: form.bookSlug,
                number: parseInt(form.number, 10),
                variant: form.variant || null,
                label: form.label,
                occasions: form.occasions.split(";").map(s => s.trim()).filter(Boolean),
                ranges,
            }),
        }).then(() => {
            setSaving(false);
            setEditing(false);
            onSaved({
                ...pericope,
                bookSlug: form.bookSlug,
                number: parseInt(form.number, 10),
                variant: form.variant || null,
                label: form.label,
                occasions: form.occasions.split(";").map(s => s.trim()).filter(Boolean),
                ranges,
            });
        });
    }, [form, pericope, onSaved]);

    const onDelete = useCallback(() => {
        if (!confirm(`Удалить зачало "${pericope.label}"?`)) return;
        fetch(`/api/admin/pericopes/${pericope.id}`, { method: "DELETE" })
            .then(() => onDeleted(pericope.id));
    }, [pericope, onDeleted]);

    if (!editing) {
        return (
            <tr className="border-b">
                <td className="pr-2 whitespace-nowrap">{pericope.label}</td>
                <td className="pr-2">{pericope.bookSlug}</td>
                <td className="pr-2 whitespace-nowrap">{formatRanges(pericope.ranges)}</td>
                <td className="pr-2 text-slate-500">{pericope.occasions.join("; ")}</td>
                <td className="pr-2">
                    <span className="cursor-pointer text-blue-700" onClick={onOpenEdit}>Править</span>
                    {" "}
                    <span className="cursor-pointer text-red-700" onClick={onDelete}>Удалить</span>
                </td>
            </tr>
        );
    }

    return (
        <tr className="border-b bg-slate-50">
            <td className="pr-2">
                <input className="border-2 w-32" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </td>
            <td className="pr-2">
                <input
                    className="border-2 w-28"
                    list="bible-book-slug-options-pericopes"
                    value={form.bookSlug}
                    onChange={e => setForm(f => ({ ...f, bookSlug: e.target.value }))}
                />
            </td>
            <td className="pr-2">
                <input className="border-2 w-48" value={form.rangesText} onChange={e => setForm(f => ({ ...f, rangesText: e.target.value }))} />
            </td>
            <td className="pr-2">
                <input className="border-2 w-64" value={form.occasions} onChange={e => setForm(f => ({ ...f, occasions: e.target.value }))} />
            </td>
            <td className="pr-2 whitespace-nowrap">
                <button onClick={onSave} disabled={saving}>{saving ? "..." : "Сохранить"}</button>
                {" "}
                <span className="cursor-pointer" onClick={() => setEditing(false)}>Отмена</span>
            </td>
        </tr>
    );
};

const PericopesContent = () => {
    const [source, setSource] = useState<"gospel" | "apostle">("gospel");
    const [bookSlug, setBookSlug] = useState("");
    const [pericopes, setPericopes] = useState<IPericope[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams({ source });
        if (bookSlug) params.set("bookSlug", bookSlug);
        fetch(`/api/admin/pericopes?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                setPericopes(data || []);
                setLoading(false);
            });
    }, [source, bookSlug]);

    useEffect(() => {
        load();
    }, [load]);

    const onSaved = useCallback((updated: IPericope) => {
        setPericopes(old => old.map(p => p.id === updated.id ? updated : p));
    }, []);

    const onDeleted = useCallback((id: string) => {
        setPericopes(old => old.filter(p => p.id !== id));
    }, []);

    const bookSlugsInSource = useMemo(
        () => Array.from(new Set(pericopes.map(p => p.bookSlug))),
        [pericopes]
    );

    return (
        <div className="flex flex-col">
            <p className="font-bold">Зачала</p>
            <p className="text-slate-500 text-sm">
                Список импортирован с azbyka.ru. Здесь можно поправить отдельные записи
                (диапазон, повод), если скрейпер что-то распознал неверно.
            </p>
            <div className="flex flex-row items-center mb-2">
                <label className="pr-2">Источник:</label>
                <select className="border-2 mr-4" value={source} onChange={e => setSource(e.target.value as "gospel" | "apostle")}>
                    <option value="gospel">Евангелие</option>
                    <option value="apostle">Апостол</option>
                </select>
                <label className="pr-2">Книга:</label>
                <input
                    className="border-2"
                    placeholder="matfeya..."
                    list="bible-book-slug-options-pericopes"
                    value={bookSlug}
                    onChange={e => setBookSlug(e.target.value)}
                />
                <datalist id="bible-book-slug-options-pericopes">
                    {BIBLE_BOOK_SLUG_OPTIONS.map(opt => (
                        <option key={opt.slug} value={opt.slug}>{opt.label}</option>
                    ))}
                </datalist>
            </div>
            {loading ? (
                <p>Загрузка...</p>
            ) : (
                <>
                    <p className="text-slate-500 text-sm">
                        Найдено: {pericopes.length} (книги в выборке: {bookSlugsInSource.join(", ") || "—"})
                    </p>
                    <table className="text-sm">
                        <thead>
                            <tr className="text-left border-b font-bold">
                                <td className="pr-2">Метка</td>
                                <td className="pr-2">Книга</td>
                                <td className="pr-2">Диапазоны</td>
                                <td className="pr-2">Повод</td>
                                <td className="pr-2">Действия</td>
                            </tr>
                        </thead>
                        <tbody>
                            {pericopes.map(p => (
                                <PericopeRow key={p.id} pericope={p} onSaved={onSaved} onDeleted={onDeleted} />
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
};

export default PericopesContent;
