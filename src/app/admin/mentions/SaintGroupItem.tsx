'use client';
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MentionCandidate, SaintGroup } from "@/app/admin/mentions/api";

const STATUS_LABEL: Record<string, string> = {
    pending: "не разобрано",
    approved: "принято",
    rejected: "отклонено",
};

const CandidateRow = ({ item, onSet }: { item: MentionCandidate; onSet: (ids: string[], status: string) => void }) => (
    <div className={`flex flex-col gap-1 border-l-2 pl-2 py-1 ${
        item.status === "approved" ? "border-green-600"
            : item.status === "rejected" ? "border-red-300 opacity-50"
                : "border-slate-300"
    }`}>
        <div className="text-sm">
            «...{item.context.replace(item.word, `⟦${item.word}⟧`)}...»
        </div>
        <div className="text-xs text-slate-500">
            в тексте:{" "}
            <Link href={`/reading/${item.textAlias || item.textId}`} target="_blank" className="underline">
                {item.textName?.slice(0, 80) || item.textId}
            </Link>
        </div>
        <div className="flex flex-row gap-2 text-xs">
            <button
                type="button"
                onClick={() => onSet([item.id], "approved")}
                className="px-2 py-0.5 border border-green-700 text-green-700 rounded"
            >
                упоминание
            </button>
            <button
                type="button"
                onClick={() => onSet([item.id], "rejected")}
                className="px-2 py-0.5 border border-red-700 text-red-700 rounded"
            >
                не он
            </button>
            <span className="text-slate-400 self-center">{STATUS_LABEL[item.status] ?? item.status}</span>
        </div>
    </div>
);

const SaintGroupItem = ({ group }: { group: SaintGroup }) => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const setStatus = useCallback(async (ids: string[], status: string) => {
        setBusy(true);
        await fetch("/api/admin/mentions/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids, status }),
        });
        setBusy(false);
        router.refresh();
    }, [router]);

    const setWholeSaint = useCallback(async (status: string) => {
        setBusy(true);
        await fetch("/api/admin/mentions/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dneslovId: group.dneslovId, status }),
        });
        setBusy(false);
        router.refresh();
    }, [group.dneslovId, router]);

    return (
        <div className={`border border-slate-300 rounded p-2 flex flex-col gap-2 ${busy ? "opacity-50" : ""}`}>
            <div className="flex flex-row items-baseline gap-3 flex-wrap">
                <button type="button" onClick={() => setOpen(!open)} className="font-bold text-left">
                    {open ? "▾" : "▸"} {group.saintTitle || `dneslov ${group.dneslovId}`}
                </button>
                <a
                    href={`https://dneslov.org/api/v0/memories/${group.dneslovId}.json`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline text-slate-500"
                >
                    dneslov {group.dneslovId}
                </a>
                <span className="text-sm text-slate-600">
                    кандидатов {group.candidates.length}
                    {group.pending > 0 && ` · не разобрано ${group.pending}`}
                    {group.approved > 0 && ` · принято ${group.approved}`}
                    {group.rejected > 0 && ` · отклонено ${group.rejected}`}
                </span>
                <div className="flex flex-row gap-2 ml-auto text-sm">
                    <button
                        type="button"
                        onClick={() => setWholeSaint("approved")}
                        className="px-2 py-0.5 border border-green-700 text-green-700 rounded"
                    >
                        принять всё
                    </button>
                    <button
                        type="button"
                        onClick={() => setWholeSaint("rejected")}
                        className="px-2 py-0.5 border border-red-700 text-red-700 rounded"
                    >
                        отклонить всё
                    </button>
                </div>
            </div>
            {open && (
                <div className="flex flex-col gap-2">
                    {group.candidates.map((c) => (
                        <CandidateRow key={c.id} item={c} onSet={setStatus} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default SaintGroupItem;
