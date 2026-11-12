'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import type { PomyannikPerson } from "@/lib/pomyannik/types";
import { readingPersons, type ReadingPlace } from "@/lib/pomyannik/reader";
import ReadingControls from "../ReadingControls";
import PersonalName from "../PersonalName";
const BUTTON = "border rounded px-4 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50";

export default function Reader({ persons, place, showSignatures }: {
    persons: PomyannikPerson[]; place: ReadingPlace | null; showSignatures: boolean;
}) {
    useEffect(() => {
        const previous = document.documentElement.dataset.readingFocus;
        document.documentElement.dataset.readingFocus = "true";
        return () => {
            if (previous === undefined) delete document.documentElement.dataset.readingFocus;
            else document.documentElement.dataset.readingFocus = previous;
        };
    }, []);
    const [group, setGroup] = useState(place?.group ?? "");
    const [kind, setKind] = useState<ReadingPlace["kind"]>(place?.kind ?? "all");
    const [personId, setPersonId] = useState(place?.personId ?? "");
    const [signatures, setSignatures] = useState(showSignatures);
    const [relations, setRelations] = useState(false);
    const [dates, setDates] = useState(false);
    const [size, setSize] = useState(36);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const [finished, setFinished] = useState(false);
    const list = readingPersons(persons, group, kind);
    const index = list.findIndex(person => person.id === personId);
    const at = index >= 0 ? index : 0;
    const current = list[at];
    const missing = Boolean(personId && index < 0);

    const save = async (person: PomyannikPerson, nextGroup = group, nextKind = kind) => {
        setBusy(true); setError(""); setStatus("Сохраняем место…");
        try {
            const response = await fetch("/api/pomyannik/reading", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place: { personId: person.id, group: nextGroup, kind: nextKind } }) });
            if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? "Не удалось сохранить место."); }
            setStatus("Место сохранено в аккаунте.");
        } catch (e) { setStatus(""); setError(e instanceof Error ? e.message : "Не удалось сохранить место. Проверьте сеть."); }
        finally { setBusy(false); }
    };
    const change = (nextGroup: string, nextKind: ReadingPlace["kind"]) => {
        setGroup(nextGroup); setKind(nextKind); setPersonId(""); setFinished(false); setStatus(""); setError("");
    };
    const go = (next: number) => {
        const person = list[next];
        if (!person || busy) return;
        setPersonId(person.id!); setFinished(false); void save(person);
    };
    return <div className="font-serif flex flex-col gap-5 max-w-3xl mx-auto py-4">
        <div className="flex justify-between gap-3 items-baseline flex-wrap"><h1 className="text-xl font-bold">Чтение помянника</h1><Link href="/pomyannik" className="underline">К помяннику</Link></div>
        <details><summary className="cursor-pointer">Состав и вид чтения</summary><div className="flex flex-col gap-4 mt-3 text-sm">
            <ReadingControls persons={persons} group={group} kind={kind} onChange={change} disabled={busy} />
            <label className="flex gap-2"><input type="checkbox" checked={signatures} onChange={e => setSignatures(e.target.checked)} />Показывать подписи</label>
            <label className="flex gap-2"><input type="checkbox" checked={relations} onChange={e => setRelations(e.target.checked)} />Показывать родство</label>
            <label className="flex gap-2"><input type="checkbox" checked={dates} onChange={e => setDates(e.target.checked)} />Показывать даты</label>
            <label className="flex flex-col gap-1">Размер имён: {size}<input type="range" min={24} max={64} step={2} value={size} onChange={e => setSize(Number(e.target.value))} /></label>
        </div></details>
        {missing && <p role="status" className="text-amber-800">Сохранённого имени больше нет в выбранном списке. Начните чтение сначала или выберите другую группу.</p>}
        {!current ? <p>В этом списке нет имён.</p> : <>
            <p className="text-center text-slate-600">{current.kind === "living" ? "О здравии" : "О упокоении"} · {at + 1} из {list.length}</p>
            <div aria-live="polite" aria-atomic="true" className="text-center rounded border border-slate-200 py-10 px-4 break-words leading-relaxed" style={{ fontSize: size }}>
                <PersonalName person={current} signatures={signatures} relations={relations} dates={dates} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <button className={BUTTON} disabled={busy || at === 0} onClick={() => go(at - 1)}>Назад</button>
                {at < list.length - 1 ? <button className={BUTTON} disabled={busy} onClick={() => go(at + 1)}>Далее</button>
                    : <button className={BUTTON} disabled={busy} onClick={() => { setFinished(true); setPersonId(current.id!); void save(current); }}>Завершить чтение</button>}
                <button className={`${BUTTON} col-span-2`} disabled={busy} onClick={() => { setPersonId(current.id!); void save(current); }}>Сохранить место</button>
            </div>
            {finished && <p role="status" className="text-center">Вы прочитали выбранный список.</p>}
            <button className="underline self-start text-sm" disabled={busy} onClick={() => go(0)}>Начать сначала</button>
            <p className="text-sm text-slate-500">При переходе сохраняется имя, на котором вы остановились. В следующий раз чтение откроется с него.</p>
        </>}
        {status && <p role="status" className="text-sm text-slate-600">{status}</p>}
        {error && <div role="alert" className="text-amber-800">{error} {current && <button className="underline" disabled={busy} onClick={() => save(current)}>Повторить сохранение</button>}</div>}
    </div>;
}
