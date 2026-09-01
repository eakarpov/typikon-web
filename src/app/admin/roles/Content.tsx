"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ROLES } from "@/lib/rights";
import type { RoleRow } from "./api";

const Content = ({ rows }: { rows: RoleRow[] }) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [email, setEmail] = useState("");
    const [role, setRole] = useState(Object.keys(ROLES)[0]);
    const [error, setError] = useState<string | null>(null);

    const call = (email: string, role: string, remove: boolean) => start(async () => {
        setError(null);
        const r = await fetch("/api/admin/roles", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, role, remove }),
        });
        if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "не вышло");
        router.refresh();
    });

    return (
        <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "1rem" }}>
            <h1 style={{ fontSize: "1.3rem" }}>Кому что можно</h1>
            <p style={{ color: "#666", fontSize: ".9rem" }}>
                Спрашивается возможность, а не звание: модератор приходов разбирает
                заявки и в разбор книг не входит вовсе.
            </p>

            <div style={{ margin: "1rem 0", fontSize: ".9rem" }}>
                <input value={email} onChange={e => setEmail(e.target.value)}
                       placeholder="почта — та, которой человек входит"
                       style={{ border: "1px solid #ccc", padding: ".25rem .4rem", width: "18rem" }} />
                <select value={role} onChange={e => setRole(e.target.value)}
                        style={{ border: "1px solid #ccc", marginLeft: ".4rem", padding: ".25rem" }}>
                    {Object.values(ROLES).map(r => (
                        <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                </select>
                <button type="button" disabled={pending || !email}
                        onClick={() => call(email, role, false)}
                        style={{ marginLeft: ".5rem", color: "#1c5a8a" }}>дать</button>
            </div>
            {error && <p style={{ color: "#8a1c1c" }}>{error}</p>}

            <p style={{ color: "#666", fontSize: ".85rem" }}>
                {Object.values(ROLES).map(r => (
                    <span key={r.key} style={{ display: "block" }}>
                        <b>{r.label}</b> — {r.note}
                    </span>
                ))}
            </p>

            {rows.map(u => (
                <div key={u.email} style={{ borderTop: "1px solid #eee", padding: ".5rem 0" }}>
                    <div>
                        <b>{u.email}</b>
                        {u.name && u.name !== u.email && <span style={{ color: "#888" }}> · {u.name}</span>}
                        {u.legacy && (
                            <span style={{ color: "#8a6d1c", fontSize: ".85rem" }}>
                                {" "}· прежний маркер isAdmin, стоит перевести
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: ".85rem", color: "#666" }}>
                        может: {u.caps.join(", ") || "—"}
                    </div>
                    <div style={{ fontSize: ".85rem", marginTop: ".2rem" }}>
                        {u.roles.map(r => (
                            <button key={r} type="button" disabled={pending}
                                    onClick={() => call(u.email, r, true)}
                                    style={{ marginRight: ".6rem", color: "#8a1c1c" }}>
                                снять «{ROLES[r]?.label ?? r}»
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Content;
