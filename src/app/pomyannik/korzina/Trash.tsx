'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PomyannikPerson } from "@/lib/pomyannik/types";
import { displayName, humanDate } from "../labels";
export default function Trash({ initial }: { initial: PomyannikPerson[] }) {
    const [persons, setPersons] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const router = useRouter();
    const restore = async (person: PomyannikPerson) => {
        setBusy(true); setError(""); setMessage("");
        try {
            const response = await fetch("/api/pomyannik/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: person.id }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Не удалось восстановить запись.");
            setPersons(current => current.filter(p => p.id !== person.id));
            setMessage(`${displayName(person)}: запись восстановлена в конце своего раздела.`);
            router.refresh();
        } catch (e) { setError(e instanceof Error ? e.message : "Не удалось восстановить запись. Проверьте сеть."); }
        finally { setBusy(false); }
    };
    return <div className="font-serif max-w-3xl py-4 space-y-4">
        <h1 className="text-xl font-bold">Корзина помянника</h1>
        <p>Удалённые записи не участвуют в чтении, календаре и новых записках. Здесь сохраняются карточки со всеми сведениями; автоматического удаления нет.</p>
        {!persons.length && <p>Корзина пуста.</p>}
        <ul className="space-y-3">{persons.map(person => <li className="border rounded p-3 flex gap-3 justify-between flex-wrap" key={person.id}>
            <div><p className="font-bold">{displayName(person)}</p><p>{person.signature}</p>
                <p className="text-sm text-slate-500">{person.kind === "living" ? "О здравии" : "О упокоении"}{person.died && ` · ${humanDate(person.died)}`}</p>
                <p className="text-sm text-slate-500">{(person.groupNames??[]).join(" · ")}</p>
            </div>
            <button className="border rounded px-3 py-2 self-center disabled:opacity-50" disabled={busy} onClick={() => restore(person)}>Восстановить</button>
        </li>)}</ul>
        {error && <p role="alert" className="text-amber-800">{error}</p>}
        {message && <p role="status">{message}</p>}
        <Link href="/pomyannik" className="underline">← К помяннику</Link>
    </div>;
}
