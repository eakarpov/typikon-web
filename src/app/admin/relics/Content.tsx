"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Relic } from "@/lib/pilgrimage/relics";
import type { Candidate } from "@/lib/pilgrimage/candidates";
import RelicForm, { type RelicFormValue } from "@/app/components/RelicForm";
import RelicLine from "@/app/components/RelicLine";

const call = async (body: unknown): Promise<string[] | null> => {
    const res = await fetch("/api/admin/relics", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.errors ?? [`ошибка ${res.status}`];
};

/** Запись — обратно в поля формы, чтобы правка начиналась с того, что есть. */
const formOf = (r: Relic): Partial<RelicFormValue> => ({
    saint: r.saintDneslovId, temple: r.templeSlug ?? "", place: r.placeId ?? "",
    kind: r.kind, state: r.state, where: r.where ?? "",
    visitFrom: r.visit?.from ?? "", visitTo: r.visit?.to ?? "",
    sourceType: r.source.type, sourceRef: r.source.ref, sourceDate: r.source.date ?? "", sourceNote: r.source.note ?? "",
    note: r.note ?? "",
});

const Row = ({ r }: { r: Relic }) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [editing, setEditing] = useState(false);
    const act = (body: object) => start(async () => { await call({ id: r.id, ...body }); router.refresh(); });

    return (
        <div className="border-t py-2">
            <ul><RelicLine relic={r} /></ul>
            {r.note && <p className="text-sm text-slate-600">{r.note}</p>}
            <div className="text-sm flex gap-3">
                {r.status !== "approved" && <button disabled={pending} className="text-green-800" onClick={() => act({ action: "status", status: "approved" })}>принять</button>}
                {r.status === "pending" && <button disabled={pending} className="text-red-800" onClick={() => act({ action: "status", status: "rejected" })}>отклонить</button>}
                {r.status === "approved" && <button disabled={pending} className="text-slate-600" onClick={() => act({ action: "status", status: "pending" })}>снять с показа</button>}
                <button className="text-amber-800" onClick={() => setEditing(!editing)}>{editing ? "закрыть" : "править"}</button>
                <button disabled={pending} className="text-red-800"
                        onClick={() => confirm("Удалить запись насовсем?") && act({ action: "delete" })}>удалить</button>
            </div>
            {editing && (
                <div className="mt-2">
                    <RelicForm initial={formOf(r)} submitLabel="Сохранить"
                               onSubmit={async (relic) => {
                                   const errs = await call({ action: "update", id: r.id, relic });
                                   if (!errs) { setEditing(false); router.refresh(); }
                                   return errs;
                               }} />
                </div>
            )}
        </div>
    );
};

/** Находка — в поля формы: всё, что обходчик сумел угадать, остаётся проверить. */
const formOfCandidate = (c: Candidate): Partial<RelicFormValue> => ({
    saint: c.saintCandidates[0]?.slug ?? c.saintCandidates[0]?.dneslovId ?? "",
    temple: c.templeSlugs[0] ?? "",
    kind: c.kind,
    state: c.state === "visiting" ? "visiting" : "present",
    visitFrom: c.visit?.from ?? "", visitTo: c.visit?.to ?? "",
    sourceType: "news", sourceRef: c.url, sourceDate: c.published ?? "",
});

const CandidateRow = ({ c }: { c: Candidate }) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [open, setOpen] = useState(false);
    return (
        <div className="border-t py-2 text-sm">
            <div>
                <a className="text-amber-800 hover:underline font-semibold" href={c.url} target="_blank" rel="noreferrer">
                    {c.title ?? c.url}
                </a>
                <span className="text-slate-500"> · {c.published ?? "дата не найдена"} · {c.site}</span>
            </div>
            {!!c.templeSlugs.length && (
                <div className="text-slate-600">
                    Храм{c.templeSlugs.length > 1 ? "ы" : ""} сайта:{" "}
                    {c.templeSlugs.map((slug, i) => (
                        <span key={slug}>{i > 0 && ", "}<a className="text-amber-800" href={`/temples/${slug}`} target="_blank" rel="noreferrer">{slug}</a></span>
                    ))}
                </div>
            )}
            <ul className="list-disc ml-5 my-1 text-slate-700">
                {c.mentions.map((m) => <li key={m.snippet}>{m.snippet}</li>)}
            </ul>
            <div className="text-slate-600">
                {c.state === "visiting" ? "похоже, принесены на время" : c.state === "present" ? "похоже, пребывают постоянно" : "состояние не ясно"}
                {c.visit && `, с ${c.visit.from} по ${c.visit.to}`}
                {c.saintGuess && <> · в тексте: «{c.saintGuess}»</>}
                {!!c.saintCandidates.length && <> · в каталоге: {c.saintCandidates.map((s) => s.name).join("; ")}</>}
            </div>
            <div className="flex gap-3 mt-1">
                <button className="text-amber-800" onClick={() => setOpen(!open)}>{open ? "закрыть" : "оформить запись"}</button>
                <button disabled={pending} className="text-red-800"
                        onClick={() => start(async () => { await call({ action: "dismiss-candidate", id: c.id }); router.refresh(); })}>
                    отклонить
                </button>
            </div>
            {open && (
                <div className="mt-2">
                    <RelicForm initial={formOfCandidate(c)} submitLabel="Внести в реестр" onSubmit={async (relic) => {
                        const errs = await call({ action: "create", relic, candidateId: c.id });
                        if (!errs) router.refresh();
                        return errs;
                    }} />
                </div>
            )}
        </div>
    );
};

const Content = ({ pending, approved, rejected, candidates, candidateTotal }: {
    pending: Relic[]; approved: Relic[]; rejected: Relic[]; candidates: Candidate[]; candidateTotal: number;
}) => {
    const router = useRouter();
    return (
        <div className="max-w-3xl mx-auto p-4 font-serif">
            <h1 className="text-xl">Реестр святынь</h1>
            <p className="text-sm text-slate-600 mb-4">
                Где пребывают мощи и их части. Запись без источника не принимается. Новость с сайта храма —
                с датой публикации: ковчеги приносят на время, и без даты новость не проверить. Принятое
                видно на странице храма, в досье святого и на странице «Что рядом».
            </p>

            <h2 className="text-lg mt-4">Ждут разбора ({pending.length})</h2>
            {pending.length ? pending.map((r) => <Row key={r.id} r={r} />) : <p className="text-sm text-slate-500">Предложений нет.</p>}

            <h2 className="text-lg mt-6">Находки обходчика сайтов храмов ({candidateTotal})</h2>
            <p className="text-sm text-slate-600">
                Страницы, где сказано о мощах. Это не записи: обходчик угадывает вид, дни и святого, а проверяет
                человек — по самой странице. Сперва принесённое на время: оно устаревает первым.
            </p>
            {candidates.length
                ? candidates.map((c) => <CandidateRow key={c.id} c={c} />)
                : <p className="text-sm text-slate-500">Находок нет. Обход: npm run relics:crawl -- --write (на сервере).</p>}
            {candidateTotal > candidates.length && <p className="text-sm text-slate-500">Показаны первые {candidates.length}.</p>}

            <h2 className="text-lg mt-6">Новая запись</h2>
            <RelicForm submitLabel="Внести" onSubmit={async (relic) => {
                const errs = await call({ action: "create", relic });
                if (!errs) router.refresh();
                return errs;
            }} />

            <h2 className="text-lg mt-6">Принятые ({approved.length})</h2>
            {approved.map((r) => <Row key={r.id} r={r} />)}

            {!!rejected.length && (
                <details className="mt-6">
                    <summary className="text-lg">Отклонённые ({rejected.length})</summary>
                    {rejected.map((r) => <Row key={r.id} r={r} />)}
                </details>
            )}
        </div>
    );
};

export default Content;
