"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { REASON_LABELS, type Proposal, type ProposalReason } from "@/lib/saintProposalTypes";

const call = async (body: unknown): Promise<string | null> => {
    const res = await fetch("/api/admin/saint-proposals", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) return null;
    return (await res.json().catch(() => null))?.error ?? `ошибка ${res.status}`;
};

const Row = ({ p }: { p: Proposal }) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [name, setName] = useState(p.name ?? "");
    const [address, setAddress] = useState(p.duplicates[0]?.slug ?? "");
    const [error, setError] = useState("");
    const act = (body: object) => start(async () => {
        const err = await call({ id: p.id, ...body });
        setError(err ?? "");
        if (!err) router.refresh();
    });

    return (
        <div className="border-t py-2 text-sm">
            <ul className="text-slate-700">
                {p.memories.map((m) => (
                    <li key={m.id}><span className="text-slate-500">{m.date} · {m.id}</span> — {m.label}</li>
                ))}
            </ul>
            {/* Подсказки сводятся по ключу записи: запись каталога могла попасть в
                подсказку дважды — по имени и по прочему имени. */}
            {!!p.duplicates.length && (
                <div className="text-slate-600">
                    Похожие в каталоге:{" "}
                    {p.duplicates.filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i).map((d, i) => (
                        <span key={d.id}>{i > 0 && "; "}
                            {d.slug ? <a className="text-amber-800" href={`/saints/${d.slug}`} target="_blank" rel="noreferrer">{d.name}</a> : d.name}
                        </span>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap gap-2 items-center mt-1">
                <input className="border rounded px-2 py-0.5 bg-white w-64" value={name} onChange={(e) => setName(e.target.value)}
                       placeholder="Имя Прозвание" aria-label="Имя святого" />
                <button disabled={pending} className="text-green-800" onClick={() => act({ action: "create", name })}>завести</button>
                <span className="text-slate-400">или</span>
                <input className="border rounded px-2 py-0.5 bg-white w-56" value={address} onChange={(e) => setAddress(e.target.value)}
                       placeholder="адрес святого в каталоге" aria-label="Адрес святого, к которому присоединить" />
                <button disabled={pending || !address} className="text-amber-800" onClick={() => act({ action: "merge", address })}>это он</button>
                <button disabled={pending} className="text-red-800" onClick={() => act({ action: "dismiss" })}>отклонить</button>
            </div>
            {error && <div className="text-red-800">{error}</div>}
        </div>
    );
};

const ORDER: ProposalReason[] = ["possible-duplicate", "no-epithet", "several", "no-name"];

const Content = ({ groups }: { groups: Record<ProposalReason, Proposal[]> }) => (
    <div className="max-w-4xl mx-auto p-4 font-serif">
        <h1 className="text-xl">Святые из памятей Минеи: на разбор</h1>
        <p className="text-sm text-slate-600 mb-3">
            Импорт завёл сам тех, у кого в подписи памяти одно лицо с именем и прозванием и кого в каталоге нет.
            Здесь — остальное. «Завести» — новая запись с этим именем (оно считается выверенным и перестройкой не
            меняется); «это он» — памяти присоединяются к записи каталога по её адресу; «отклонить» — не лицо или
            не нужно.
        </p>
        {ORDER.map((reason) => (
            <section key={reason} className="mb-6">
                <h2 className="text-lg">{REASON_LABELS[reason]} ({groups[reason]?.length ?? 0})</h2>
                {(groups[reason] ?? []).map((p) => <Row key={p.id} p={p} />)}
            </section>
        ))}
    </div>
);

export default Content;
