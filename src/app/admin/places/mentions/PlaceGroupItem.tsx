'use client';
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PlaceGroup, PlaceMentionItem } from "@/app/admin/places/mentions/api";

const STATUS_LABEL: Record<string, string> = { pending: "не разобрано", approved: "принято", rejected: "отклонено" };
const SIGNAL_LABEL: Record<string, string> = {
    "place-word": "рядом «град/страна…»", adjective: "прилагательное", none: "без признака", markup: "разметка",
};

const Row = ({ item, onSet }: { item: PlaceMentionItem; onSet: (ids: string[], status: string) => void }) => (
    <div className={`flex flex-col gap-1 border-l-2 pl-2 py-1 ${
        item.status === "approved" ? "border-green-600" : item.status === "rejected" ? "border-red-300 opacity-50" : "border-slate-300"
    }`}>
        <div className="text-sm">«…{item.context.replace(item.word, `⟦${item.word}⟧`)}…»</div>
        <div className="text-xs text-slate-500">
            в тексте:{" "}
            <Link href={`/reading/${item.textAlias || item.textId}`} target="_blank" className="underline">
                {item.textName?.slice(0, 80) || item.textId}
            </Link>
            {" · "}{SIGNAL_LABEL[item.signal] ?? item.signal}
            {item.count > 1 && ` · в тексте ${item.count} раз`}
        </div>
        {/* Пометку {pl|…} ставил редактор — её снимают правкой текста, а не здесь. */}
        {item.method !== "markup" && (
            <div className="flex flex-row gap-2 text-xs">
                <button type="button" onClick={() => onSet([item.id], "approved")} className="px-2 py-0.5 border border-green-700 text-green-700 rounded">это место</button>
                <button type="button" onClick={() => onSet([item.id], "rejected")} className="px-2 py-0.5 border border-red-700 text-red-700 rounded">не оно</button>
                <span className="text-slate-400 self-center">{STATUS_LABEL[item.status] ?? item.status}</span>
            </div>
        )}
    </div>
);

const PlaceGroupItem = ({ group }: { group: PlaceGroup }) => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const send = useCallback(async (body: Record<string, unknown>) => {
        setBusy(true);
        await fetch("/api/admin/places/mentions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        setBusy(false);
        router.refresh();
    }, [router]);

    return (
        <div className={`border border-slate-300 rounded p-2 flex flex-col gap-2 ${busy ? "opacity-50" : ""}`}>
            <div className="flex flex-row items-baseline gap-3 flex-wrap">
                <button type="button" onClick={() => setOpen(!open)} className="font-bold text-left">
                    {open ? "▾" : "▸"} {group.placeName}
                </button>
                {group.placeSlug && (
                    <Link href={`/places/${group.placeSlug}`} target="_blank" className="text-xs underline text-slate-500">страница места</Link>
                )}
                <span className="text-sm text-slate-600">
                    упоминаний {group.items.length}
                    {group.pending > 0 && ` · не разобрано ${group.pending}`}
                    {group.approved > 0 && ` · принято ${group.approved}`}
                    {group.rejected > 0 && ` · отклонено ${group.rejected}`}
                </span>
                <div className="flex flex-row gap-2 ml-auto text-sm">
                    <button type="button" onClick={() => send({ placeId: group.placeId, status: "approved" })} className="px-2 py-0.5 border border-green-700 text-green-700 rounded">принять неразобранное</button>
                    <button type="button" onClick={() => send({ placeId: group.placeId, status: "rejected" })} className="px-2 py-0.5 border border-red-700 text-red-700 rounded">отклонить неразобранное</button>
                </div>
            </div>
            {open && (
                <div className="flex flex-col gap-2">
                    {group.items.map((item) => <Row key={item.id} item={item} onSet={(ids, status) => send({ ids, status })} />)}
                </div>
            )}
        </div>
    );
};

export default PlaceGroupItem;
