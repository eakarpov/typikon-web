'use client';
import React from "react";
import type { Commemorator } from "@/lib/pomyannik/commemorators";
import type { NoteKind } from "@/lib/pomyannik/types";
import { NOTE_KINDS } from "@/lib/pomyannik/types";

// ЗАЯВКА И НАСТРОЙКИ ПРИЁМА — одна страница на два состояния: пока права нет,
// здесь заявка; когда есть — ссылка-приглашение и то, что священник о себе
// правит сам. Разводить это по двум адресам незачем: приходят сюда с одним
// вопросом — «как ко мне подадут записку».

const FIELD = "border rounded px-2 py-1 font-serif bg-white text-sm w-full";
const BUTTON = "border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100 font-serif text-sm";

interface ClaimView {
    title: string; dioceseUrl: string; email: string;
    status: string; decisionNote?: string | null; again?: boolean;
}

const STATUS_WORDS: Record<string, string> = {
    "pending": "Заявка подана. На указанный адрес придёт письмо с просьбой её подтвердить — "
        + "ответьте на него, не удаляя код подтверждения из текста.",
    "letter-sent": "Письмо с просьбой подтвердить заявку отправлено на указанный адрес. Ответьте "
        + "на него, не удаляя код подтверждения из текста, — этим и подтверждается, что заявку "
        + "подали вы.",
    "verified": "Ответ получен, код подтверждения сошёлся. Осталось решение — оно за человеком, "
        + "не за машиной.",
    "rejected": "Заявку мы не приняли.",
};

const Claim = ({ initial }: { initial: ClaimView | null }) => {
    const [claim, setClaim] = React.useState(initial);
    const [form, setForm] = React.useState({
        title: initial?.title ?? "", dioceseUrl: initial?.dioceseUrl ?? "",
        email: initial?.email ?? "", evidence: "",
    });
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [domain, setDomain] = React.useState<string | null>(null);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/commemorator/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) { setError(body?.error ?? "не удалось подать заявку"); return; }
            setClaim(body.claim);
            setDomain(body.domain?.note ?? null);
        } finally {
            setBusy(false);
        }
    };

    const waiting = claim && claim.status !== "rejected";

    return (
        <div className="flex flex-col gap-4 max-w-xl">
            {waiting ? (
                <>
                    <p className="font-serif text-slate-800">{STATUS_WORDS[claim!.status]}</p>
                    {domain && <p className="font-serif text-sm text-slate-500">{domain}</p>}
                    <dl className="font-serif text-sm grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
                        <dt className="text-slate-500">кто</dt><dd>{claim!.title}</dd>
                        <dt className="text-slate-500">страница епархии</dt>
                        <dd className="break-all">{claim!.dioceseUrl}</dd>
                        <dt className="text-slate-500">почта</dt><dd>{claim!.email}</dd>
                    </dl>
                </>
            ) : (
                <form onSubmit={send} className="flex flex-col gap-3">
                    {claim?.status === "rejected" && (
                        <p className="font-serif text-amber-700 text-sm">
                            {STATUS_WORDS.rejected}
                            {claim.decisionNote && <> Причина: {claim.decisionNote}</>} Подать снова
                            можно — заявка придёт помеченной, и прежнее решение при ней останется.
                        </p>
                    )}
                    <label className="flex flex-col gap-1 font-serif text-sm">
                        <span className="text-slate-600">сан и имя</span>
                        <input className={FIELD} required placeholder="иерей Николай Петров"
                               value={form.title}
                               onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-1 font-serif text-sm">
                        <span className="text-slate-600">
                            страница епархии, где вы названы
                            <span className="text-slate-400 text-xs"> · обязательно</span>
                        </span>
                        <input className={FIELD} required type="url"
                               placeholder="https://eparhia.ru/clergy/"
                               value={form.dioceseUrl}
                               onChange={e => setForm(f => ({ ...f, dioceseUrl: e.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-1 font-serif text-sm">
                        <span className="text-slate-600">
                            почта в домене этой епархии
                            <span className="text-slate-400 text-xs"> · туда уйдёт письмо с просьбой подтвердить заявку</span>
                        </span>
                        <input className={FIELD} required type="email"
                               value={form.email}
                               onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-1 font-serif text-sm">
                        <span className="text-slate-600">
                            дополнительные сведения для администратора
                            <span className="text-slate-400 text-xs"> · не обязательно</span>
                        </span>
                        <textarea rows={3} className={FIELD} value={form.evidence}
                                  onChange={e => setForm(f => ({ ...f, evidence: e.target.value }))} />
                    </label>
                    {error && <p className="font-serif text-sm text-amber-700">{error}</p>}
                    <div><button className={BUTTON} disabled={busy}>подать заявку</button></div>
                </form>
            )}
        </div>
    );
};

const Settings = ({ initial, origin }: { initial: Commemorator; origin: string }) => {
    const [person, setPerson] = React.useState(initial);
    const [busy, setBusy] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const invite = `${origin}/pomyannik/podat/${person.inviteCode}`;
    const open = `${origin}/pominovenie/${person.slug}`;

    const save = async (patch: Record<string, unknown>) => {
        setBusy(true);
        setCopied(false);
        try {
            const response = await fetch("/api/commemorator", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            if (response.ok) setPerson(await response.json());
        } finally {
            setBusy(false);
        }
    };

    const toggleKind = (kind: NoteKind) => {
        const next = person.accepts.includes(kind)
            ? person.accepts.filter(k => k !== kind)
            : [...person.accepts, kind];
        save({ accepts: next });
    };

    return (
        <div className="flex flex-col gap-5 max-w-xl">
            <div className="flex flex-col gap-1">
                <span className="font-serif text-sm text-slate-600">
                    ссылка-приглашение <span className="text-slate-400 text-xs">
                        · её раздают прихожанам или вешают на стенде
                    </span>
                </span>
                <div className="flex flex-wrap gap-2 items-center">
                    <input readOnly value={invite} onFocus={e => e.currentTarget.select()}
                           className="border rounded px-2 py-1 font-serif bg-white text-xs flex-1 min-w-0" />
                    <button className={BUTTON} type="button"
                            onClick={() => { navigator.clipboard?.writeText(invite); setCopied(true); }}>
                        {copied ? "скопировано" : "скопировать"}
                    </button>
                </div>
                <button className={`${BUTTON} self-start mt-1`} disabled={busy}
                        onClick={() => {
                            if (window.confirm("Сменить ссылку? Прежняя перестанет работать, и "
                                + "раздавать придётся заново.")) save({ resetCode: true });
                        }}>
                    сменить ссылку
                </button>
            </div>

            <label className="flex flex-col gap-1 font-serif text-sm">
                <span className="text-slate-600">где служите<span className="text-slate-400 text-xs"> · подпись, а не право на храм</span></span>
                <input className={FIELD} defaultValue={person.place ?? ""}
                       onBlur={e => e.target.value !== (person.place ?? "") && save({ place: e.target.value })} />
            </label>

            <label className="flex flex-col gap-1 font-serif text-sm">
                <span className="text-slate-600">о себе<span className="text-slate-400 text-xs"> · увидят те, кто подаёт</span></span>
                <textarea rows={3} className={FIELD} defaultValue={person.about ?? ""}
                          onBlur={e => e.target.value !== (person.about ?? "") && save({ about: e.target.value })} />
            </label>

            <div className="flex flex-col gap-1">
                <span className="font-serif text-sm text-slate-600">
                    что принимаете
                    <span className="text-slate-400 text-xs"> · не отмечено ничего — принимаете всё</span>
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-serif text-sm">
                    {NOTE_KINDS.map(kind => (
                        <label key={kind.key} className="flex gap-1 items-center">
                            <input type="checkbox" disabled={busy}
                                   checked={person.accepts.includes(kind.key)}
                                   onChange={() => toggleKind(kind.key)} />
                            {kind.label}
                        </label>
                    ))}
                </div>
            </div>

            {/* ОТКРЫТЫЙ ПРИЁМ — ЕГО РЕШЕНИЕ, А НЕ НАШЕ. Принятая заявка даёт
                право принимать, а не обязанность стоять в общем списке */}
            <label className="flex gap-2 items-start font-serif text-sm">
                <input type="checkbox" className="mt-1" checked={person.public} disabled={busy}
                       onChange={e => save({ public: e.target.checked })} />
                <span>
                    принимать записки от всех
                    <span className="block text-slate-500 text-xs">
                        тогда вы попадёте в открытый список на /pominovenie, и подать вам
                        сможет любой вошедший, а не только те, кому вы дали ссылку
                    </span>
                </span>
            </label>

            {person.public && (
                <p className="font-serif text-sm text-slate-600 break-all">
                    открытая страница: {open}
                </p>
            )}
        </div>
    );
};

const Priem = ({ claim, person, origin }: {
    claim: ClaimView | null; person: Commemorator | null; origin: string;
}) => person
    ? <Settings initial={person} origin={origin} />
    : <Claim initial={claim} />;

export default Priem;
