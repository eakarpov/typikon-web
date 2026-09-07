'use client';
import React from "react";
import type { ClaimRow } from "./api";

// РАЗБОР ЗАЯВОК НА ПРИЁМ ЗАПИСОК.
//
// Порядок действий здесь не случаен и стоит на виду: отправить письмо → дождаться
// ответа с кодом → принять. Разбирающий может и перескочить (кнопки не заперты
// друг за другом), но видит, чего не сделал: заявка, принятая без ответного
// письма, — это заявка, принятая на честное слово, и знать об этом он должен.

const BUTTON = "border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100 font-serif text-sm";

const STATUS: Record<string, string> = {
    "pending": "подана, письмо не отправлено",
    "letter-sent": "письмо отправлено, ждём ответа",
    "verified": "ответ получен, код сошёлся",
};

const MATCH_COLOR: Record<string, string> = {
    exact: "text-slate-600",
    subdomain: "text-slate-600",
    different: "text-amber-700",
    unknown: "text-amber-700",
};

const Content = ({ claims }: { claims: ClaimRow[] }) => {
    const [rows, setRows] = React.useState(claims);
    const [busy, setBusy] = React.useState<string | null>(null);
    const [notes, setNotes] = React.useState<Record<string, string>>({});
    const [said, setSaid] = React.useState<Record<string, string>>({});

    const act = async (userId: string, action: string) => {
        if (action === "approve" && !window.confirm(
            "Принять заявку? Сайт откроет этому человеку приём записок от прихожан.")) return;
        setBusy(userId);
        try {
            const response = await fetch("/api/admin/commemorators", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, action, note: notes[userId] }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) {
                setSaid(s => ({ ...s, [userId]: body?.error ?? "не вышло" }));
                return;
            }
            if (action === "approve" || action === "reject") {
                setRows(current => current.filter(r => r.userId !== userId));
                return;
            }
            if (action === "letter") {
                setSaid(s => ({ ...s, [userId]: body?.mailed
                    ? "письмо ушло" : "письмо НЕ ушло — смотрите журнал" }));
                setRows(current => current.map(r => r.userId === userId
                    ? { ...r, status: "letter-sent", letterSentAt: new Date().toISOString() } : r));
                return;
            }
            setRows(current => current.map(r => r.userId === userId
                ? { ...r, status: "verified", repliedAt: new Date().toISOString() } : r));
        } finally {
            setBusy(null);
        }
    };

    if (!rows.length) {
        return <p className="font-serif text-slate-600 pt-4">Неразобранных заявок нет.</p>;
    }

    return (
        <div className="flex flex-col gap-6 pt-4">
            <h1 className="font-bold font-serif">Заявки на приём записок</h1>

            {rows.map(claim => (
                <section key={claim.userId} className="border rounded p-4 flex flex-col gap-2 max-w-3xl">
                    <div className="flex flex-wrap gap-3 items-baseline">
                        <h2 className="font-bold font-serif">{claim.title}</h2>
                        <span className="font-serif text-xs text-slate-500">
                            {STATUS[claim.status] ?? claim.status}
                        </span>
                        {claim.again && (
                            <span className="font-serif text-xs text-amber-700">
                                подана снова после отказа{claim.priorNote && `: ${claim.priorNote}`}
                            </span>
                        )}
                    </div>

                    <dl className="font-serif text-sm grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1">
                        <dt className="text-slate-500">страница епархии</dt>
                        <dd>
                            <a href={claim.dioceseUrl} target="_blank" rel="noreferrer noopener"
                               className="text-red-900 hover:underline break-all">
                                {claim.dioceseUrl}
                            </a>
                        </dd>
                        <dt className="text-slate-500">почта</dt>
                        <dd className="break-all">{claim.email}</dd>
                        <dt className="text-slate-500">домены</dt>
                        <dd className={MATCH_COLOR[claim.domainMatch] ?? ""}>{claim.domainNote}</dd>
                        <dt className="text-slate-500">код в письме</dt>
                        <dd><code className="text-xs">{claim.token}</code></dd>
                        {claim.evidence && (
                            <><dt className="text-slate-500">от заявителя</dt>
                              <dd className="whitespace-pre-wrap">{claim.evidence}</dd></>)}
                        {claim.letterSentAt && (
                            <><dt className="text-slate-500">письмо ушло</dt>
                              <dd>{new Date(claim.letterSentAt).toLocaleString("ru-RU")}</dd></>)}
                        {claim.repliedAt && (
                            <><dt className="text-slate-500">ответ получен</dt>
                              <dd>{new Date(claim.repliedAt).toLocaleString("ru-RU")}
                                  {claim.checkNote && ` — ${claim.checkNote}`}</dd></>)}
                    </dl>

                    <textarea
                        rows={2}
                        className="border rounded px-2 py-1 font-serif bg-white text-sm w-full"
                        placeholder="что сказать заявителю — уйдёт письмом"
                        value={notes[claim.userId] ?? ""}
                        onChange={e => setNotes(n => ({ ...n, [claim.userId]: e.target.value }))}
                    />

                    <div className="flex flex-wrap gap-2 items-center">
                        <button className={BUTTON} disabled={busy === claim.userId}
                                onClick={() => act(claim.userId, "letter")}>
                            {claim.letterSentAt ? "отправить письмо снова" : "отправить письмо с кодом"}
                        </button>
                        <button className={BUTTON} disabled={busy === claim.userId}
                                onClick={() => act(claim.userId, "replied")}>
                            ответ получен, код сошёлся
                        </button>
                        <button className={BUTTON} disabled={busy === claim.userId}
                                onClick={() => act(claim.userId, "approve")}>
                            принять
                        </button>
                        <button className={BUTTON} disabled={busy === claim.userId}
                                onClick={() => act(claim.userId, "reject")}>
                            отказать
                        </button>
                        {said[claim.userId] && (
                            <span className="font-serif text-xs text-slate-500">{said[claim.userId]}</span>
                        )}
                    </div>

                    {claim.status !== "verified" && (
                        <p className="font-serif text-xs text-amber-700">
                            Ответного письма ещё не было. Принять можно и так, но тогда сан
                            подтверждён только страницей епархии — то есть тем, что такой
                            священник есть, а не тем, что заявку подал он.
                        </p>
                    )}
                </section>
            ))}
        </div>
    );
};

export default Content;
