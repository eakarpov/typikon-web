'use client';
import React from "react";
import Link from "next/link";
import type { PomyannikPerson, PersonKind } from "@/lib/pomyannik/types";
import { displayName, humanDate, rankLabel } from "@/app/pomyannik/labels";

// РАЗВОРОТ ПОМЯННИКА: слева о здравии, справа о упокоении. Так он разграфлён на
// бумаге, и переучивать человека, у которого этот разворот перед глазами
// двадцать лет, незачем.
//
// БЫСТРАЯ СТРОКА ПОД КАЖДЫМ СТОЛБЦОМ, а не одно поле на страницу: вписывают
// имена не вперемешку, а подряд в свой столбец, и лишний выбор «куда» на каждом
// имени — это лишнее движение тридцать раз подряд.

const FIELD = "border rounded px-2 py-1 font-serif bg-white text-sm";
const BUTTON = "border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100 font-serif text-sm";

const TITLE: Record<PersonKind, string> = {
    living: "О здравии",
    departed: "О упокоении",
};

const Column = ({
    kind, persons, onAdd, onRemove, busy,
}: {
    kind: PersonKind;
    persons: PomyannikPerson[];
    onAdd: (kind: PersonKind, name: string) => Promise<void>;
    onRemove: (id: string) => Promise<void>;
    busy: boolean;
}) => {
    const [draft, setDraft] = React.useState("");

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = draft.trim();
        if (!name) return;
        setDraft("");
        await onAdd(kind, name);
    };

    return (
        <section className="flex flex-col gap-2 flex-1 min-w-0">
            <h2 className="font-bold font-serif border-b pb-1">
                {TITLE[kind]}
                <span className="text-slate-400 font-normal text-sm"> · {persons.length}</span>
            </h2>

            {persons.length === 0 && (
                <p className="font-serif text-sm text-slate-500">Пока пусто.</p>
            )}

            <ul className="flex flex-col">
                {persons.map(person => (
                    <li key={person.id}
                        className="font-serif text-sm py-1 flex gap-2 items-baseline group">
                        <Link href={`/pomyannik/${person.id}`}
                              className="text-slate-800 hover:text-red-900 hover:underline">
                            {rankLabel(person.rank, person.sex) && (
                                <span className="text-slate-500">
                                    {rankLabel(person.rank, person.sex)}{" "}
                                </span>
                            )}
                            {displayName(person)}
                        </Link>
                        {person.died && (
                            <span className="text-slate-400 text-xs">
                                † {humanDate(person.died)}
                            </span>
                        )}
                        {person.relation && (
                            <span className="text-slate-400 text-xs">{person.relation}</span>
                        )}
                        <button
                            type="button"
                            onClick={() => onRemove(person.id!)}
                            title="Убрать из помянника"
                            className="ml-auto text-slate-300 hover:text-red-900 opacity-0
                                       group-hover:opacity-100 focus:opacity-100 px-1"
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ul>

            <form onSubmit={submit} className="flex gap-2 pt-1">
                <input
                    className={`${FIELD} flex-1 min-w-0`}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="имя"
                    list="pomyannik-names"
                    autoComplete="off"
                    disabled={busy}
                />
                <button className={BUTTON} disabled={busy || !draft.trim()}>вписать</button>
            </form>
        </section>
    );
};

const Book = ({ initial, names }: { initial: PomyannikPerson[]; names: string[] }) => {
    const [persons, setPersons] = React.useState(initial);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const add = async (kind: PersonKind, name: string) => {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/pomyannik", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, kind }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                setError(body?.error ?? "не удалось вписать имя");
                return;
            }
            const { persons: created } = await response.json();
            setPersons(current => [...current, ...created]);
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: string) => {
        // Спрашиваем: строка помянника — не запись в списке дел, и вернуть её
        // человек сможет только вспомнив дату преставления заново.
        if (!window.confirm("Убрать имя из помянника?")) return;
        setBusy(true);
        try {
            const response = await fetch(`/api/pomyannik/${id}`, { method: "DELETE" });
            if (response.ok) setPersons(current => current.filter(p => p.id !== id));
        } finally {
            setBusy(false);
        }
    };

    const of = (kind: PersonKind) => persons.filter(p => p.kind === kind);

    return (
        <div className="flex flex-col gap-3">
            {error && <p className="font-serif text-sm text-amber-700">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-8">
                <Column kind="living" persons={of("living")} onAdd={add} onRemove={remove} busy={busy} />
                <Column kind="departed" persons={of("departed")} onAdd={add} onRemove={remove} busy={busy} />
            </div>
            <datalist id="pomyannik-names">
                {names.map(name => <option key={name} value={name} />)}
            </datalist>
        </div>
    );
};

export default Book;
