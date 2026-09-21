'use client';

import { useMemo, useState } from "react";
import PostItem from "@/app/admin/channel-posts/PostItem";
import NewPostForm from "@/app/admin/channel-posts/NewPostForm";
import { ChannelPostDTO } from "@/types/dto/channelPost";

/**
 * Две вкладки: рабочий список и архив.
 *
 * Опубликованные посты не требуют никаких действий, а в общем списке копились и
 * отодвигали вниз то, ради чего страницу и открывают, — черновики, которые надо
 * прочитать и подтвердить. Поэтому они отделены, и в архиве их можно прибрать
 * пачкой: по одному полсотни записей не удалишь.
 */

const TAB = "font-serif px-3 py-1 border rounded";
const TAB_ON = "bg-slate-200 border-slate-400";
const TAB_OFF = "border-slate-300 hover:bg-slate-50";

const moscowTime = (value?: string | null) =>
    value ? new Date(value).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) : "—";

const ArchiveRow = ({
    item,
    checked,
    onToggle,
}: {
    item: ChannelPostDTO;
    checked: boolean;
    onToggle: () => void;
}) => (
    <label className="flex flex-row items-start gap-3 border rounded border-slate-300 px-3 py-2 cursor-pointer hover:bg-slate-50">
        <input type="checkbox" className="mt-1" checked={checked} onChange={onToggle} />
        <span className="flex flex-col gap-0.5">
            <span className="font-serif text-sm">
                {item.dayAlias} — {item.slot === "morning" ? "утро" : "вечер"} — опубликовано{" "}
                {moscowTime(item.publishedAt ?? item.scheduledAt)} МСК
            </span>
            <span className="font-serif text-xs text-slate-600">
                {item.sourceTextName || item.text.replace(/<[^>]+>/g, " ").slice(0, 90)}
            </span>
        </span>
    </label>
);

const Archive = ({
    items,
    onRemoved,
}: {
    items: ChannelPostDTO[];
    onRemoved: (ids: string[]) => void;
}) => {
    const [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");

    const toggle = (id: string) =>
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const allSelected = items.length > 0 && selected.length === items.length;

    const onDelete = async () => {
        if (!selected.length) return;
        if (!window.confirm(`Удалить безвозвратно опубликованных постов: ${selected.length}?`)) return;
        setBusy(true);
        setMessage("");
        try {
            const res = await fetch("/api/admin/channel-posts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selected }),
            });
            if (!res.ok) {
                setMessage(`Не удалось удалить: ошибка ${res.status}`);
                return;
            }
            const data = await res.json().catch(() => ({ deleted: selected.length }));
            // Удалённое убирается из списка здесь, а не перезагрузкой страницы:
            // router.refresh() пересоздал бы дерево и погасил бы сообщение о том,
            // что сделано. Список живёт выше, чтобы и счётчик на вкладке считал
            // то же, что видно, — иначе он остаётся прежним и врёт.
            onRemoved(selected);
            setSelected([]);
            setMessage(`Удалено: ${data.deleted ?? selected.length}`);
        } finally {
            setBusy(false);
        }
    };

    // Пустой архив не уводит отсюда возврат: удалив последние записи, человек
    // должен увидеть, что удалилось, а не только «здесь пусто».
    if (!items.length && !message) {
        return <p className="font-serif">Опубликованных постов нет.</p>;
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-row items-center gap-2">
                {items.length > 0 && (
                    <>
                        <button
                            type="button"
                            className="border rounded border-slate-300 px-2 py-1 text-sm font-serif hover:bg-slate-50"
                            onClick={() => setSelected(allSelected ? [] : items.map((item) => item.id))}
                        >
                            {allSelected ? "Снять отметки" : "Отметить все"}
                        </button>
                        <button
                            type="button"
                            className="border rounded border-red-300 text-red-700 px-2 py-1 text-sm font-serif hover:bg-red-50 disabled:opacity-50"
                            disabled={busy || !selected.length}
                            onClick={onDelete}
                        >
                            {busy ? "Удаляю…" : `Удалить отмеченные (${selected.length})`}
                        </button>
                    </>
                )}
                {message && <span className="font-serif text-sm text-slate-700">{message}</span>}
            </div>

            {!items.length && <p className="font-serif">Опубликованных постов нет.</p>}

            {items.map((item) => (
                <ArchiveRow
                    key={item.id}
                    item={item}
                    checked={selected.includes(item.id)}
                    onToggle={() => toggle(item.id)}
                />
            ))}
        </div>
    );
};

const Tabs = ({ drafts, archive }: { drafts: ChannelPostDTO[]; archive: ChannelPostDTO[] }) => {
    const [tab, setTab] = useState<"work" | "archive">("work");
    const [removed, setRemoved] = useState<string[]>([]);

    const archiveItems = useMemo(
        () => archive.filter((item) => !removed.includes(item.id)),
        [archive, removed],
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-2">
                <button
                    type="button"
                    className={`${TAB} ${tab === "work" ? TAB_ON : TAB_OFF}`}
                    onClick={() => setTab("work")}
                >
                    В работе — {drafts.length}
                </button>
                <button
                    type="button"
                    className={`${TAB} ${tab === "archive" ? TAB_ON : TAB_OFF}`}
                    onClick={() => setTab("archive")}
                >
                    Архив — {archiveItems.length}
                </button>
            </div>

            {tab === "work" ? (
                <div className="flex flex-col gap-4">
                    <NewPostForm />
                    {drafts.length === 0 && (
                        <p>
                            Пусто. Черновики появляются автоматически по крону
                            (см. <code>npm run channel-posts:generate</code>).
                        </p>
                    )}
                    {drafts.map((item) => (
                        <PostItem key={item.id} item={item} />
                    ))}
                </div>
            ) : (
                <Archive
                    items={archiveItems}
                    onRemoved={(ids) => setRemoved((prev) => [...prev, ...ids])}
                />
            )}
        </div>
    );
};

export default Tabs;
