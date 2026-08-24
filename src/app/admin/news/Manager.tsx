'use client';
import React from "react";
import Markdown from "react-markdown";
import { CacheTag } from "@/lib/cache";
import { revalidateTags } from "@/lib/admin/revalidate";
import type { NewsPostDTO, NewsType } from "@/types/dto/news";

// Редактор новостей.
//
// Черновик и выложенное различаются одной кнопкой: черновик не виден нигде, кроме этой
// страницы. Дата публикации ставится один раз — правка выложенной новости не поднимает
// её обратно наверх ленты и не зажигает читателям точку «новое» повторно.

const TYPE_LABELS: Record<NewsType, string> = {
    update: "Обновление",
    announcement: "Объявление",
};

const dateLabel = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "—";

interface Draft {
    title: string;
    summary: string;
    body: string;
    type: NewsType;
    version: string;
    alias?: string;
}

const emptyDraft = (): Draft => ({ title: "", summary: "", body: "", type: "update", version: "" });

const Manager = ({ items }: { items: NewsPostDTO[] }) => {
    const [posts, setPosts] = React.useState(items);
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [editing, setEditing] = React.useState<string | null>(null);
    const [creating, setCreating] = React.useState(false);

    const send = async (url: string, options: RequestInit) => {
        setBusy(true);
        setError(null);

        try {
            const res = await fetch(url, options);
            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data?.error || "Не получилось");

            if (Array.isArray(data.items)) setPosts(data.items);
            // Лента, RSS и /api/v2/news читают одну кэшированную выборку — сбрасываем её,
            // иначе новость появится на сайте только по истечении часа.
            await revalidateTags([CacheTag.NEWS]);

            return data;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не получилось");
            return null;
        } finally {
            setBusy(false);
        }
    };

    const save = (id: string, patch: Partial<Draft> & { status?: string }) =>
        send(`/api/admin/news/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        });

    const create = async (draft: Draft, status: "draft" | "published") => {
        const data = await send("/api/admin/news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...draft, status }),
        });

        if (data) setCreating(false);
    };

    const remove = (post: NewsPostDTO) => {
        if (!confirm(`Удалить «${post.title}»? Это навсегда.`)) return;
        send(`/api/admin/news/${post.id}`, { method: "DELETE" });
    };

    const drafts = posts.filter((post) => post.status === "draft").length;

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-row gap-4 items-baseline flex-wrap">
                <p className="font-bold">Новости — {posts.length}</p>
                <p className="text-sm text-slate-600">черновиков {drafts}</p>
                <a href="/news" className="text-sm underline" target="_blank" rel="noreferrer">лента на сайте</a>
                <a href="/rss.xml" className="text-sm underline" target="_blank" rel="noreferrer">RSS</a>
            </div>

            <p className="text-sm text-slate-600">
                Черновик виден только здесь. Выложенная новость появляется в ленте, в RSS,
                в <code>/api/v2/news</code> и зажигает точку «новое» в меню у тех, кто уже читал.
            </p>

            {error && <p className="text-red-700">{error}</p>}

            {creating ? (
                <Editor
                    initial={emptyDraft()}
                    busy={busy}
                    onCancel={() => setCreating(false)}
                    onSave={(draft) => create(draft, "draft")}
                    onPublish={(draft) => create(draft, "published")}
                />
            ) : (
                <button className="border-2 px-2 py-1 self-start" onClick={() => setCreating(true)}>
                    Написать новость
                </button>
            )}

            <ul className="flex flex-col gap-4">
                {posts.map((post) => (
                    <li key={post.id} className="flex flex-col gap-1 border-l-2 border-slate-300 pl-3 py-1">
                        <div className="flex flex-row gap-2 items-baseline flex-wrap">
                            <span className="font-bold">{post.title}</span>
                            <span className="text-xs border px-1 rounded">{TYPE_LABELS[post.type]}</span>
                            {post.version && <span className="text-xs border px-1 rounded">версия {post.version}</span>}
                            {post.status === "draft"
                                ? <span className="text-xs text-amber-800">черновик</span>
                                : <span className="text-sm text-slate-600">выложена {dateLabel(post.publishedAt)}</span>}
                        </div>

                        <p className="text-sm text-slate-600">
                            <a href={`/news/${post.alias}`} className="underline" target="_blank" rel="noreferrer">
                                /news/{post.alias}
                            </a>
                            {post.summary && ` · ${post.summary}`}
                        </p>

                        <div className="flex flex-row gap-3 text-sm">
                            <button className="underline" onClick={() => setEditing(editing === post.id ? null : post.id)}>
                                {editing === post.id ? "не менять" : "изменить"}
                            </button>
                            {post.status === "draft" ? (
                                <button className="underline text-green-800" disabled={busy}
                                        onClick={() => save(post.id, { status: "published" })}>
                                    выложить
                                </button>
                            ) : (
                                <button className="underline text-slate-700" disabled={busy}
                                        onClick={() => save(post.id, { status: "draft" })}>
                                    снять с ленты
                                </button>
                            )}
                            <button className="underline text-red-700" disabled={busy} onClick={() => remove(post)}>
                                удалить
                            </button>
                        </div>

                        {editing === post.id && (
                            <Editor
                                initial={{
                                    title: post.title,
                                    summary: post.summary,
                                    body: post.body,
                                    type: post.type,
                                    version: post.version ?? "",
                                    alias: post.alias,
                                }}
                                busy={busy}
                                onCancel={() => setEditing(null)}
                                onSave={async (draft) => {
                                    const data = await save(post.id, draft);
                                    if (data) setEditing(null);
                                }}
                            />
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const Editor = ({
    initial, busy, onSave, onPublish, onCancel,
}: {
    initial: Draft;
    busy: boolean;
    onSave: (draft: Draft) => void;
    onPublish?: (draft: Draft) => void;
    onCancel: () => void;
}) => {
    const [draft, setDraft] = React.useState<Draft>(initial);
    const [preview, setPreview] = React.useState(false);

    const set = (patch: Partial<Draft>) => setDraft((old) => ({ ...old, ...patch }));

    return (
        <div className="flex flex-col gap-2 border-2 border-slate-200 rounded p-3 mt-1">
            <div className="flex flex-row gap-3 flex-wrap items-end">
                <div className="flex flex-col grow">
                    <label className="text-sm">Заголовок</label>
                    <input className="border-2 px-1" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm">Вид</label>
                    <select className="border-2 px-1" value={draft.type}
                            onChange={(e) => set({ type: e.target.value as NewsType })}>
                        {(Object.keys(TYPE_LABELS) as NewsType[]).map((type) => (
                            <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col">
                    <label className="text-sm">Версия</label>
                    <input className="border-2 px-1 w-24" value={draft.version} placeholder="не обязательно"
                           onChange={(e) => set({ version: e.target.value })} />
                </div>
            </div>

            <div className="flex flex-col">
                <label className="text-sm">Коротко (уходит в RSS и в описание страницы)</label>
                <input className="border-2 px-1" value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />
            </div>

            <div className="flex flex-col">
                <div className="flex flex-row gap-3 items-baseline">
                    <label className="text-sm">Текст (markdown)</label>
                    <button className="text-sm underline" onClick={() => setPreview(!preview)}>
                        {preview ? "править" : "посмотреть"}
                    </button>
                </div>
                {preview ? (
                    <div className="border-2 p-2 min-h-32 markdown-body">
                        <Markdown>{draft.body}</Markdown>
                    </div>
                ) : (
                    <textarea className="border-2 px-1 min-h-32 font-mono text-sm" value={draft.body}
                              onChange={(e) => set({ body: e.target.value })} />
                )}
            </div>

            <div className="flex flex-row gap-3 items-baseline">
                <button className="border-2 px-2 py-1" disabled={busy || !draft.title.trim()}
                        onClick={() => onSave(draft)}>
                    {busy ? "Сохраняю…" : "Сохранить"}
                </button>
                {onPublish && (
                    <button className="border-2 px-2 py-1" disabled={busy || !draft.title.trim()}
                            onClick={() => onPublish(draft)}>
                        Сохранить и выложить
                    </button>
                )}
                <button className="underline text-sm" onClick={onCancel}>отмена</button>
            </div>
        </div>
    );
};

export default Manager;
