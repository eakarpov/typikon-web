'use client';
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ArticleGroup, NikiforCandidateView } from "@/app/admin/places/nikifor/api";

const STATUS_LABEL: Record<string, string> = { pending: "не разобрано", approved: "принято", rejected: "отклонено" };
const VIA_LABEL: Record<string, string> = { wikidata: "по Wikidata", verses: "по общим стихам" };

const Row = ({ item, onSet, busy }: { item: NikiforCandidateView; onSet: (id: string, status: string) => void; busy: boolean }) => (
    <div className={`flex flex-col gap-1 border-l-2 pl-2 py-1 ${
        item.status === "approved" ? "border-green-600" : item.status === "rejected" ? "border-red-300 opacity-60" : "border-slate-300"
    }`}>
        <div className="flex flex-row flex-wrap items-baseline gap-x-2">
            {item.place.href
                ? <Link href={item.place.href} target="_blank" className="font-bold underline">{item.place.name}</Link>
                : <span className="font-bold">{item.place.name}</span>}
            {item.place.kind && <span className="text-sm text-slate-500">{item.place.kind}</span>}
            <Link href={`/admin/places/${item.place.id}`} target="_blank" className="text-xs underline text-slate-500">редактор места</Link>
        </div>
        {item.place.names.length > 0 && <div className="text-xs text-slate-600">имена: {item.place.names.join(", ")}</div>}
        {item.place.articles.length > 0 && <div className="text-xs text-slate-600">уже статьи: {item.place.articles.join(", ")}</div>}
        <div className="text-xs text-slate-500">
            {VIA_LABEL[item.via] ?? item.via}{item.overlap > 0 && `, общих стихов ${item.overlap}`} · {item.reason}
        </div>
        <div className="flex flex-row gap-2 text-xs items-center">
            {item.status !== "approved" && (
                <button type="button" disabled={busy} onClick={() => onSet(item.id, "approved")} className="px-2 py-0.5 border border-green-700 text-green-700 rounded">
                    статья об этом месте
                </button>
            )}
            {item.status !== "rejected" && (
                <button type="button" disabled={busy} onClick={() => onSet(item.id, "rejected")} className="px-2 py-0.5 border border-red-700 text-red-700 rounded">
                    не о нём
                </button>
            )}
            {item.status !== "pending" && (
                <button type="button" disabled={busy} onClick={() => onSet(item.id, "pending")} className="px-2 py-0.5 border border-slate-400 text-slate-600 rounded">
                    вернуть в разбор
                </button>
            )}
            <span className="text-slate-400">{STATUS_LABEL[item.status] ?? item.status}</span>
        </div>
    </div>
);

const ArticleGroupItem = ({ group }: { group: ArticleGroup }) => {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const setStatus = useCallback(async (id: string, status: string) => {
        setBusy(true);
        setMessage(null);
        const res = await fetch("/api/admin/places/nikifor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) setMessage(body.error ?? "Не удалось записать решение");
        else if (body.renamed) setMessage(`Месту дано имя «${body.renamed}»${body.published ? ", страница открыта" : ""}.`);
        setBusy(false);
        router.refresh();
    }, [router]);

    return (
        <div className={`border border-slate-300 rounded p-3 flex flex-col gap-2 ${busy ? "opacity-60" : ""}`}>
            <div className="flex flex-row flex-wrap items-baseline gap-3">
                <Link href={`/reading/${group.alias}`} target="_blank" className="font-bold text-lg underline">{group.name}</Link>
                <span className="text-sm text-slate-600">кандидатов {group.candidates.length}{group.pending > 0 && ` · не разобрано ${group.pending}`}</span>
            </div>
            {group.snippet && <p className="text-sm text-slate-700">{group.snippet}…</p>}
            {group.attachedTo.length > 0 && (
                <p className="text-xs text-slate-600">
                    статья уже стоит у:{" "}
                    {group.attachedTo.map((a, i) => (
                        <span key={i}>
                            {i > 0 && ", "}
                            {a.href ? <Link href={a.href} target="_blank" className="underline">{a.name}</Link> : a.name}
                            {a.byReview ? " (на ревью)" : " (скриптом)"}
                        </span>
                    ))}
                </p>
            )}
            {message && <p className="text-sm text-amber-800">{message}</p>}
            <div className="flex flex-col gap-2">
                {group.candidates.map((c) => <Row key={c.id} item={c} onSet={setStatus} busy={busy} />)}
            </div>
        </div>
    );
};

export default ArticleGroupItem;
