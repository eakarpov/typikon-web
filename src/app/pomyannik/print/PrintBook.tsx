'use client';
import { useState } from "react";
import Link from "next/link";
import type { PomyannikPerson } from "@/lib/pomyannik/types";
import { readingPersons, type ReadingPlace } from "@/lib/pomyannik/reader";
import ReadingControls from "../ReadingControls";
import PersonalName from "../PersonalName";
import styles from "./PrintBook.module.css";
export default function PrintBook({ persons, showSignatures }: { persons: PomyannikPerson[]; showSignatures: boolean }) {
    const [group, setGroup] = useState("");
    const [kind, setKind] = useState<ReadingPlace["kind"]>("all");
    const [signatures, setSignatures] = useState(showSignatures);
    const [relations, setRelations] = useState(true);
    const [dates, setDates] = useState(false);
    const list = readingPersons(persons, group, kind);
    return <div className="font-serif py-4">
        <div className="print:hidden flex flex-col gap-4 mb-6 text-sm">
            <Link href="/pomyannik" className="underline">← К помяннику</Link>
            <p>Личный помянник для домашнего чтения. Выберите, какие сведения оставить на бумаге.</p>
            <ReadingControls persons={persons} group={group} kind={kind} onChange={(g, k) => { setGroup(g); setKind(k); }} />
            <div className="flex flex-wrap gap-4">
                <label className="flex gap-2"><input type="checkbox" checked={signatures} onChange={e => setSignatures(e.target.checked)} />Подписи</label>
                <label className="flex gap-2"><input type="checkbox" checked={relations} onChange={e => setRelations(e.target.checked)} />Родство</label>
                <label className="flex gap-2"><input type="checkbox" checked={dates} onChange={e => setDates(e.target.checked)} />Даты рождения и преставления</label>
            </div>
            <button type="button" disabled={!list.length} className="border rounded px-4 py-2 bg-slate-50 self-start disabled:opacity-50" onClick={() => window.print()}>Печатать личный помянник</button>
        </div>
        <article className={styles.sheet}>
            <h1 className="text-2xl font-bold">Помянник</h1>
            {group && <p>{group}</p>}
            {!list.length && <p>В выбранном списке нет имён.</p>}
            {(["living", "departed"] as const).map(section => {
                const entries = list.filter(person => person.kind === section);
                return entries.length > 0 && <section className={styles.section} key={section}>
                    <h2 className="font-bold text-xl border-b pb-1">{section === "living" ? "О здравии" : "О упокоении"}</h2>
                    <ul>{entries.map(person => <li key={person.id} className={styles.person}><PersonalName person={person} signatures={signatures} relations={relations} dates={dates} /></li>)}</ul>
                </section>;
            })}
        </article>
    </div>;
}
