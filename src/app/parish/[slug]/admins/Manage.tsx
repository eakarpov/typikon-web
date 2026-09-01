"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface AdminRow {
    userId: string; email: string | null; name: string | null;
    addedByEmail: string | null; staleDays: number | null; isMe: boolean;
}

export const Manage = ({ slug, rows }: { slug: string; rows: AdminRow[] }) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);

    const call = (body: object) => start(async () => {
        setError(null);
        const r = await fetch(`/api/parish/${slug}/admins`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "не вышло");
        else setEmail("");
        router.refresh();
    });

    return (
        <div style={{ maxWidth: "40rem" }}>
            {rows.map(a => (
                <div key={a.userId} style={{ borderTop: "1px solid #eee", padding: ".5rem 0" }}>
                    <b>{a.email ?? a.userId}</b>
                    {a.isMe && <span style={{ color: "#888" }}> — это вы</span>}
                    <div style={{ fontSize: ".85rem", color: "#666" }}>
                        {a.addedByEmail ? `позван: ${a.addedByEmail}` : "заведён сайтом"}
                        {/* ПРАВО НЕ ПРОТУХАЕТ САМО, но давнее молчание видно:
                            первый признак, что храм осиротел */}
                        {a.staleDays !== null && a.staleDays > 180 && (
                            <span style={{ color: "#8a6d1c" }}>
                                {" "}· правом не пользовались {a.staleDays} дней
                            </span>
                        )}
                    </div>
                    {rows.length > 1 && (
                        <button type="button" disabled={pending}
                                onClick={() => call({ email: a.email, userId: a.userId, remove: true })}
                                style={{ color: "#8a1c1c", fontSize: ".85rem" }}>
                            снять
                        </button>
                    )}
                </div>
            ))}

            <div style={{ marginTop: "1rem", fontSize: ".9rem" }}>
                <input value={email} onChange={e => setEmail(e.target.value)}
                       placeholder="почта — та, которой он входит на сайт"
                       style={{ border: "1px solid #ccc", padding: ".25rem .4rem", width: "20rem" }} />
                <button type="button" disabled={pending || !email}
                        onClick={() => call({ email })}
                        style={{ marginLeft: ".5rem", color: "#1c5a8a" }}>
                    позвать
                </button>
            </div>
            {error && <p style={{ color: "#8a1c1c" }}>{error}</p>}
            <p style={{ color: "#888", fontSize: ".85rem", marginTop: ".5rem" }}>
                Позванный сможет всё то же, что и вы, — и звать других. Последнего
                ведущего снять нельзя: храм без него никто уже не поправит.
            </p>
        </div>
    );
};
