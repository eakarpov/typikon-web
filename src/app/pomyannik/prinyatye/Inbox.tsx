'use client';
import React from "react";
import type { Zapiska } from "@/lib/pomyannik/zapiski";
import { NOTE_KIND_BY_KEY } from "@/lib/pomyannik/types";
import { humanDate } from "@/app/pomyannik/labels";
import NoteSheet, { type SheetName } from "@/app/pomyannik/NoteSheet";

// ПОДАННЫЕ ЗАПИСКИ.
//
// Неразобранные сверху: за ними и приходят. Прочтение отмечается одной кнопкой —
// священник у аналоя, а не за столом, и трёх нажатий на записку у него нет.
//
// СКАЗАНО, ГДЕ СКЛОНЕНИЕ НАШЕ. Имя, которого нет в словаре, приходит в том
// падеже, в каком его вписал подавший, и молча выдать это за проверенный
// родительный значило бы подсунуть читающему ошибку, которой он не делал.

const BUTTON = "border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100 font-serif text-sm";

const Inbox = ({ initial }: { initial: Zapiska[] }) => {
    const [notes, setNotes] = React.useState(initial);
    const [busy, setBusy] = React.useState<string | null>(null);

    const mark = async (id: string, what: "read" | "finished") => {
        setBusy(id);
        try {
            const response = await fetch(`/api/zapiski/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mark: what }),
            });
            if (!response.ok) return;
            const at = new Date().toISOString() as unknown as Date;
            setNotes(current => current.map(n => n.id === id
                ? { ...n, ...(what === "read" ? { readAt: at } : { finishedAt: at }) } : n));
        } finally {
            setBusy(null);
        }
    };

    if (!notes.length) {
        return <p className="font-serif text-sm text-slate-600">Записок пока не подавали.</p>;
    }

    return (
        <ul className="flex flex-col gap-4">
            {notes.map(note => {
                const info = NOTE_KIND_BY_KEY[note.kind];
                const groups = (["living", "departed"] as const)
                    .map(section => ({
                        section,
                        list: note.names.filter(n => n.kind === section).map((n): SheetName => ({
                            rank: n.rank, sex: n.sex,
                            text: n.slavonic || n.churchName || n.name,
                            declined: n.slavonicSource === "lexicon",
                        })),
                    }))
                    .filter(g => g.list.length);
                const doubtful = note.names.filter(n => n.slavonicSource !== "lexicon");

                return (
                    <li key={note.id}
                        className={`border rounded p-4 flex flex-col gap-2 max-w-md
                                    ${note.readAt ? "border-slate-200" : "border-amber-700"}`}>
                        <div className="flex flex-wrap gap-2 items-baseline">
                            <span className="font-serif font-bold text-sm">{info?.label ?? note.kind}</span>
                            <span className="font-serif text-xs text-slate-500">
                                подана {humanDate(String(note.createdAt).slice(0, 10))}
                            </span>
                            {!note.readAt && (
                                <span className="font-serif text-xs text-amber-700">не прочитана</span>
                            )}
                        </div>

                        {note.span && (
                            <p className="font-serif text-xs text-slate-500">
                                срок: с {humanDate(note.span.from)} по {humanDate(note.span.to)}
                                {note.finishedAt && " — отмечено оконченным"}
                            </p>
                        )}

                        {note.sweptAt ? (
                            <p className="font-serif text-sm text-slate-500">
                                Имена стёрты по сроку хранения: было {note.namesCount}.
                            </p>
                        ) : (
                            /* Записка показывается тем же видом, каким её
                               собирал подавший: священник читает то же самое, а
                               не наш пересказ */
                            <NoteSheet groups={groups} />
                        )}

                        {!note.sweptAt && doubtful.length > 0 && (
                            <p className="font-serif text-xs text-amber-700">
                                Не склонено нами: {doubtful.map(n => n.churchName || n.name).join(", ")} —
                                этих имён нет в церковнославянском словаре, и стоят они так, как их
                                вписал подавший.
                            </p>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {!note.readAt && (
                                <button className={BUTTON} disabled={busy === note.id}
                                        onClick={() => mark(note.id!, "read")}>
                                    прочитано
                                </button>
                            )}
                            {note.span && note.readAt && !note.finishedAt && (
                                <button className={BUTTON} disabled={busy === note.id}
                                        onClick={() => mark(note.id!, "finished")}>
                                    поминовение окончено
                                </button>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

export default Inbox;
