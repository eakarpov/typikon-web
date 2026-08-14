'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

const toDatetimeLocalValue = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const NewPostForm = () => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [hashtags, setHashtags] = useState("");
    const [dayAlias, setDayAlias] = useState("");
    const [slot, setSlot] = useState<"morning" | "evening">("morning");
    const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalValue(new Date()));
    const [saving, setSaving] = useState(false);

    const onSubmit = async () => {
        if (!text.trim()) return;
        setSaving(true);
        try {
            await fetch("/api/admin/channel-posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    imageUrl: imageUrl || null,
                    hashtags: hashtags.split(/\s+/).filter(Boolean),
                    dayAlias,
                    slot,
                    scheduledAt: new Date(scheduledAt).toISOString(),
                }),
            });
            setText("");
            setImageUrl("");
            setHashtags("");
            setDayAlias("");
            setOpen(false);
            router.refresh();
        } finally {
            setSaving(false);
        }
    };

    if (!open) {
        return (
            <button className="border px-2 py-1 self-start" onClick={() => setOpen(true)}>
                + Создать пост вручную
            </button>
        );
    }

    return (
        <div className="flex flex-col border rounded border-slate-300 p-3 gap-2 bg-slate-50">
            <p className="font-bold">Новый пост (без генератора)</p>
            <textarea
                className="border p-2 font-serif"
                rows={8}
                placeholder="Текст поста (HTML для Telegram — <b>, <a href=...></a>)"
                value={text}
                onChange={(e) => setText(e.target.value)}
            />
            <input
                className="border p-1"
                placeholder="URL картинки (необязательно)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
            />
            <input
                className="border p-1"
                placeholder="#хэштеги через пробел"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
            />
            <input
                className="border p-1"
                placeholder="alias дня, например july-09 (необязательно)"
                value={dayAlias}
                onChange={(e) => setDayAlias(e.target.value)}
            />
            <div className="flex flex-row gap-2 items-center">
                <label className="flex flex-row items-center gap-1">
                    <input
                        type="radio"
                        checked={slot === "morning"}
                        onChange={() => setSlot("morning")}
                    />
                    утро
                </label>
                <label className="flex flex-row items-center gap-1">
                    <input
                        type="radio"
                        checked={slot === "evening"}
                        onChange={() => setSlot("evening")}
                    />
                    вечер
                </label>
                <input
                    type="datetime-local"
                    className="border p-1"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                />
            </div>
            <div className="flex flex-row gap-2">
                <button className="border px-2 py-1" disabled={saving || !text.trim()} onClick={onSubmit}>
                    Создать черновик
                </button>
                <button className="border px-2 py-1" onClick={() => setOpen(false)}>
                    Отмена
                </button>
            </div>
        </div>
    );
};

export default NewPostForm;
