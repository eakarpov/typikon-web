"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Started { token: string; website: string | null; method: string }

export const ClaimForm = ({ slug, website, existing }: {
    slug: string; website: string | null;
    existing: { token: string; status: string; checkNote?: string | null } | null;
}) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [role, setRole] = useState("");
    const [contact, setContact] = useState("");
    const [evidence, setEvidence] = useState("");
    const [started, setStarted] = useState<Started | null>(
        existing ? { token: existing.token, website, method: website ? "site-token" : "manual" } : null);
    const [note, setNote] = useState<string | null>(existing?.checkNote ?? null);
    const [error, setError] = useState<string | null>(null);

    const send = () => start(async () => {
        setError(null);
        const r = await fetch(`/api/parish/${slug}/claim`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role, contact, evidence }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setError(d.error ?? "не вышло"); return; }
        setStarted(d);
    });

    const check = () => start(async () => {
        setError(null);
        const r = await fetch(`/api/parish/${slug}/claim`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ check: true }),
        });
        const d = await r.json().catch(() => ({}));
        setNote(d.note ?? d.error ?? null);
        if (d.granted) router.push(`/parish/${slug}`);
        else router.refresh();
    });

    const field = { border: "1px solid #ccc", padding: ".3rem .4rem",
                    width: "100%", marginTop: ".2rem" } as const;

    if (started) {
        return (
            <div>
                {started.website ? (
                    <>
                        <p>
                            Положите этот знак на сайт прихода — в файл{" "}
                            <code>/.well-known/typikon.txt</code>, или{" "}
                            <code>/typikon.txt</code>, или просто на главную страницу:
                        </p>
                        <p style={{ fontFamily: "monospace", fontSize: "1.1rem",
                                    background: "#f4f4f4", padding: ".5rem .75rem" }}>
                            {started.token}
                        </p>
                        <p style={{ color: "#666", fontSize: ".9rem" }}>
                            Проверим по адресу <b>{started.website}</b> — тому, что записан
                            у храма в справочнике. Кто может править сайт прихода, тот и приход.
                        </p>
                        <button type="button" disabled={pending} onClick={check}
                                style={{ border: "1px solid #1c5a8a", color: "#1c5a8a",
                                         padding: ".3rem .8rem" }}>
                            Проверить
                        </button>
                        {note && <p style={{ marginTop: ".5rem", color: "#8a6d1c" }}>{note}</p>}
                        <p style={{ color: "#666", fontSize: ".9rem", marginTop: ".75rem" }}>
                            Не выходит — ничего: заявка уже принята, с вами свяжутся.
                        </p>
                    </>
                ) : (
                    <p>
                        Заявка принята. Сайта у храма в справочнике нет, и проверить
                        машиной нечем — с вами свяжутся по указанному контакту.
                    </p>
                )}
            </div>
        );
    }

    return (
        <div style={{ maxWidth: "32rem" }}>
            <label style={{ display: "block", marginBottom: ".6rem" }}>
                Кто вы в приходе
                <input value={role} onChange={e => setRole(e.target.value)} style={field}
                       placeholder="регент, староста, помощник настоятеля…" />
            </label>
            <label style={{ display: "block", marginBottom: ".6rem" }}>
                Как с вами связаться
                <input value={contact} onChange={e => setContact(e.target.value)} style={field}
                       placeholder="телефон или почта" />
            </label>
            <label style={{ display: "block", marginBottom: ".6rem" }}>
                Чем подтвердите <span style={{ color: "#888" }}>(необязательно)</span>
                <textarea value={evidence} onChange={e => setEvidence(e.target.value)}
                          style={{ ...field, minHeight: "4rem" }}
                          placeholder="ссылка на страницу прихода, где вы названы; телефон настоятеля; что угодно, что можно проверить" />
            </label>
            <button type="button" disabled={pending} onClick={send}
                    style={{ border: "1px solid #1c5a8a", color: "#1c5a8a", padding: ".3rem .8rem" }}>
                Отправить заявку
            </button>
            {error && <p style={{ color: "#8a1c1c" }}>{error}</p>}
        </div>
    );
};
