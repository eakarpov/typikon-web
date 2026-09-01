"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface ClaimRow {
    id: string;
    templeSlug: string;
    templeName: string;
    templePlace: string | null;
    website: string | null;
    phone: string | null;
    userId: string;
    userEmail: string | null;
    role: string;
    contact: string;
    evidence: string | null;
    status: string;
    method: string;
    checkNote: string | null;
    createdAt: string;
    /** Подана снова после отказа — и вот что решили тогда. */
    again: boolean;
    priorNote: string | null;
}

const STATUS = {
    verified: { label: "знак на сайте сошёлся", color: "#1c6b2f", back: "#f2f7f2" },
    pending: { label: "ждёт разбора", color: "#8a6d1c", back: "#fdf8ee" },
} as const;

const Row = ({ c }: { c: ClaimRow }) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [note, setNote] = useState("");
    const s = STATUS[c.status as keyof typeof STATUS] ?? STATUS.pending;

    const decide = (approve: boolean) => start(async () => {
        await fetch("/api/admin/parish-claims", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: c.id, approve, note }),
        });
        router.refresh();
    });

    return (
        <div style={{ borderTop: "1px solid #eee", padding: ".7rem 0", background: s.back }}>
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "baseline" }}>
                <a href={`/temples/${c.templeSlug}`} style={{ fontWeight: 600 }}>{c.templeName}</a>
                <span style={{ color: "#888", fontSize: ".85rem" }}>{c.templePlace ?? ""}</span>
                <span style={{ color: s.color, fontSize: ".85rem" }}>· {s.label}</span>
            </div>
            <div style={{ fontSize: ".9rem", marginTop: ".2rem" }}>
                <b>{c.role}</b>, {c.contact}
                {c.userEmail && <span style={{ color: "#888" }}> · вход: {c.userEmail}</span>}
            </div>
            {/* ПОВТОРНАЯ ЗАЯВКА НАЗЫВАЕТСЯ ПОВТОРНОЙ. Прежде отказ стирался
                следующей подачей, и разбирающий видел её как новую — то есть
                собственное решение обходилось нажатием кнопки */}
            {c.again && (
                <div style={{ fontSize: ".9rem", color: "#8a1c1c", marginTop: ".2rem" }}>
                    Подана снова после отказа{c.priorNote ? `: «${c.priorNote}»` : ""}
                </div>
            )}
            {c.evidence && (
                <div style={{ fontSize: ".9rem", color: "#444", marginTop: ".2rem" }}>
                    {c.evidence}
                </div>
            )}
            {/* ЧТО МЫ ЗНАЕМ О ХРАМЕ — рядом, чтобы не искать: модератору
                звонить по этому телефону и смотреть этот сайт */}
            <div style={{ fontSize: ".85rem", color: "#666", marginTop: ".2rem" }}>
                {c.website ? <>сайт: <a href={c.website} target="_blank" rel="noreferrer">{c.website}</a></>
                           : "сайта в справочнике нет"}
                {c.phone && <> · телефон: {c.phone}</>}
                {c.checkNote && <> · проверка: {c.checkNote}</>}
            </div>
            <div style={{ marginTop: ".4rem", fontSize: ".85rem" }}>
                <input value={note} onChange={e => setNote(e.target.value)}
                       placeholder="почему так решили — останется в записи"
                       style={{ border: "1px solid #ccc", padding: ".2rem .4rem", width: "22rem" }} />
                <button type="button" disabled={pending} onClick={() => decide(true)}
                        style={{ marginLeft: ".5rem", color: "#1c6b2f" }}>назначить</button>
                <button type="button" disabled={pending} onClick={() => decide(false)}
                        style={{ marginLeft: ".5rem", color: "#8a1c1c" }}>отказать</button>
            </div>
        </div>
    );
};

const Content = ({ claims }: { claims: ClaimRow[] }) => (
    <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "1rem" }}>
        <h1 style={{ fontSize: "1.3rem" }}>Заявки на ведение расписания</h1>
        <p style={{ color: "#666", fontSize: ".9rem" }}>
            Сюда доходят только заявки на храмы, у которых ведущего нет: если он есть,
            зовёт он сам. Сошедшийся знак на сайте прихода назначает без нас — здесь
            остаётся то, что решать человеку.
        </p>
        {claims.length === 0 && <p style={{ color: "#999", marginTop: "1rem" }}>Заявок нет.</p>}
        {claims.map(c => <Row key={c.id} c={c} />)}
    </div>
);

export default Content;
