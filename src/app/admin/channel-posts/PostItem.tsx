'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChannelPostDTO } from "@/types/dto/channelPost";

const STATUS_LABEL: Record<string, string> = {
    draft: "Черновик",
    ready: "Готово к отправке",
    published: "Опубликовано",
    failed: "Ошибка отправки",
    skipped: "Пропущено",
};

const STATUS_CLASS: Record<string, string> = {
    draft: "bg-slate-200",
    ready: "bg-green-200",
    published: "bg-blue-200",
    failed: "bg-red-200",
    skipped: "bg-yellow-200",
};

const PostItem = ({ item }: { item: ChannelPostDTO }) => {
    const router = useRouter();
    const [text, setText] = useState(item.text || "");
    const [imageUrl, setImageUrl] = useState(item.imageUrl || "");
    const [hashtags, setHashtags] = useState((item.hashtags || []).join(" "));
    const [status, setStatus] = useState(item.status);
    const [vkEnabled, setVkEnabled] = useState(!!item.targets?.vk);
    const [saving, setSaving] = useState(false);
    const [deleted, setDeleted] = useState(false);

    const save = async (fields: Record<string, unknown>) => {
        setSaving(true);
        try {
            await fetch(`/api/admin/channel-posts/${item.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fields),
            });
        } finally {
            setSaving(false);
        }
    };

    const onSave = () =>
        save({ text, imageUrl, hashtags: hashtags.split(/\s+/).filter(Boolean) });

    const onToggleReady = async () => {
        const next = status === "ready" ? "draft" : "ready";
        setStatus(next);
        await save({ status: next });
    };

    const onToggleVk = async () => {
        const next = !vkEnabled;
        setVkEnabled(next);
        await save({ targets: { telegram: true, vk: next } });
    };

    const onDelete = async () => {
        if (!window.confirm("Удалить этот пост безвозвратно?")) return;
        setSaving(true);
        try {
            await fetch(`/api/admin/channel-posts/${item.id}`, { method: "DELETE" });
            setDeleted(true);
            router.refresh();
        } finally {
            setSaving(false);
        }
    };

    if (deleted) return null;

    return (
        <div className="flex flex-col border rounded border-slate-300 p-3 gap-2">
            <div className="flex flex-row justify-between items-center">
                <span className="font-serif">
                    {item.dayAlias} — {item.slot === "morning" ? "утро (9:00)" : "вечер (18:00)"} —{" "}
                    {new Date(item.scheduledAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК
                </span>
                <span className={`text-xs px-2 py-1 rounded ${STATUS_CLASS[status] || "bg-slate-200"}`}>
                    {STATUS_LABEL[status] || status}
                </span>
            </div>

            {item.nameSource === "heuristic" && (
                <div className="text-amber-700 text-sm">
                    ⚠️ Хэштег определён эвристикой (нет данных в Днеслове для этой памяти) — проверьте вручную
                </div>
            )}
            {item.nameSource === "none" && (
                <div className="text-amber-700 text-sm">
                    ⚠️ Не удалось определить святого для хэштега — заполните вручную
                </div>
            )}

            <div className="flex flex-row gap-4">
                {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" style={{ width: 120, height: "auto" }} />
                ) : (
                    <div className="text-sm text-slate-400 flex items-center justify-center border border-dashed" style={{ width: 120, height: 120 }}>
                        Без фото
                    </div>
                )}
                <div className="flex flex-col flex-1 gap-2">
                    <textarea
                        className="border p-2 font-serif"
                        rows={10}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <input
                        className="border p-1"
                        placeholder="URL картинки"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                    />
                    <input
                        className="border p-1"
                        placeholder="#хэштеги через пробел"
                        value={hashtags}
                        onChange={(e) => setHashtags(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-row items-center gap-2">
                <button className="border px-2 py-1" disabled={saving} onClick={onSave}>
                    Сохранить
                </button>
                <button className="border px-2 py-1" onClick={onToggleReady}>
                    {status === "ready" ? "Вернуть в черновики" : "Готово к отправке"}
                </button>
                <button className="border px-2 py-1 text-red-700" disabled={saving} onClick={onDelete}>
                    Удалить
                </button>
                <label className="flex flex-row items-center gap-1 text-sm ml-4">
                    <input type="checkbox" checked={vkEnabled} onChange={onToggleVk} disabled />
                    Дублировать в VK (пока недоступно)
                </label>
            </div>
        </div>
    );
};

export default PostItem;
