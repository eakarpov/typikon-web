"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
    SOURCE_LABELS, type GroupPage, type TempleFindings,
} from "@/lib/pilgrimage/prestolSources";

// Разбор находок престолов глазами: сводка классами и поштучный список.

const call = async (body: unknown): Promise<string | null> => {
    const res = await fetch("/api/admin/prestoly", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.errors?.[0] ?? `ошибка ${res.status}`;
};

const pct = (c: number | undefined) => (c == null ? "—" : `${Math.round(c * 100)}%`);
const src = (s: string) => SOURCE_LABELS[s] ?? s;

const Kind = ({ kind }: { kind?: string }) =>
    kind && kind !== "saint" ? <span className="text-xs text-slate-400">{kind}</span> : null;

const SourceBadge = ({ source }: { source: string }) => (
    <span className={`text-xs px-1.5 py-0.5 rounded ${
        source === "sobory" ? "bg-amber-100 text-amber-800"
        : source === "site" ? "bg-emerald-100 text-emerald-800"
        : "bg-slate-100 text-slate-600"}`}>{src(source)}</span>
);

const Btn = ({ label, tone, busy, onClick }: {
    label: string; tone: "ok" | "no"; busy: boolean; onClick: () => void;
}) => (
    <button type="button" onClick={onClick} disabled={busy}
        className={`text-xs px-2 py-0.5 rounded border disabled:opacity-40 ${
            tone === "ok"
                ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                : "border-rose-300 text-rose-700 hover:bg-rose-50"}`}>
        {label}
    </button>
);

const Content = ({ view, counts, groups, temples, source, dedication, search, offset, pageSize }: {
    view: "groups" | "temples";
    counts: Record<string, Record<string, number>>;
    groups: GroupPage;
    temples: { items: TempleFindings[]; total: number };
    source: string;
    dedication: string;
    search: string;
    offset: number;
    pageSize: number;
}) => {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async (key: string, body: unknown, confirmText?: string) => {
        if (confirmText && !confirm(confirmText)) return;
        setBusy(key);
        setError(null);
        const err = await call(body);
        setBusy(null);
        if (err) setError(err);
        else router.refresh();
    };

    const href = (patch: Record<string, string | number | undefined>) => {
        const p = new URLSearchParams();
        const merged = { view, source, dedication, search, ...patch };
        for (const [k, v] of Object.entries(merged)) {
            if (v === undefined || v === "") continue;
            const s = String(v);
            if (k === "offset" && s === "0") continue;
            p.set(k, s);
        }
        return `/admin/prestoly?${p.toString()}`;
    };

    const sources = ["name", "name-secondary", "site", "sobory"];
    const pending = (s: string) => counts[s]?.pending ?? 0;
    const approved = (s: string) => counts[s]?.approved ?? 0;
    const totalPending = sources.reduce((n, s) => n + pending(s), 0);

    return (
        <div className="max-w-4xl mx-auto p-4 font-serif">
            <h1 className="text-xl">Разбор престолов</h1>
            <p className="text-sm text-slate-600 mt-1 mb-3">
                Посвящение престола выведено догадкой — из имени храма, с сайта прихода или из Соборов.ру.
                Пока разбор не увидел человек, престол не показывается читателю и не отдаётся уставу.
                Ошибка в правиле обычно общая для целого класса, поэтому разбирать удобнее сводкой:
                одна правка снимает тысячи ложных связей. Находки с отрывком (сайт, собор) судят по странице.
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mb-3">
                {sources.map((s) => (
                    <span key={s}><SourceBadge source={s} /> ждёт {pending(s).toLocaleString("ru")}
                        <span className="text-slate-400"> · принято {approved(s).toLocaleString("ru")}</span></span>
                ))}
                <span className="font-medium text-slate-800">всего ждёт {totalPending.toLocaleString("ru")}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
                <span className="text-slate-500">Вид:</span>
                <Link href={href({ view: "groups", offset: 0, dedication: "" })}
                      className={view === "groups" ? "font-medium underline" : "text-slate-500"}>по посвящениям</Link>
                <Link href={href({ view: "temples", offset: 0 })}
                      className={view === "temples" ? "font-medium underline" : "text-slate-500"}>по храмам</Link>
                <span className="mx-2 text-slate-300">|</span>
                <span className="text-slate-500">Источник:</span>
                <Link href={href({ source: "", offset: 0 })}
                      className={!source ? "font-medium underline" : "text-slate-500"}>все</Link>
                {sources.map((s) => (
                    <Link key={s} href={href({ source: s, offset: 0, dedication: "" })}
                          className={source === s ? "font-medium underline" : "text-slate-500"}>{src(s)}</Link>
                ))}
            </div>

            <form className="mb-4 text-sm" action="/admin/prestoly" method="get">
                <input type="hidden" name="view" value={view} />
                {source && <input type="hidden" name="source" value={source} />}
                {dedication && <input type="hidden" name="dedication" value={dedication} />}
                <input name="search" defaultValue={search} placeholder="поиск по посвящению или имени храма"
                       className="border rounded px-2 py-1 w-72" />
                <button type="submit" className="ml-2 border rounded px-2 py-1">Найти</button>
                {search && <Link href={href({ search: "", offset: 0 })} className="ml-2 text-slate-500">сбросить</Link>}
            </form>

            {error && <p className="text-sm text-rose-700 mb-3">Ошибка: {error}</p>}

            {dedication && view === "temples" && (
                <p className="text-sm mb-3">
                    Только посвящение: <strong>{dedication}</strong>{" "}
                    <Link href={href({ dedication: "", offset: 0 })} className="text-slate-500">показать все</Link>
                </p>
            )}

            {view === "groups" ? (
                <GroupsTable groups={groups} busy={busy} run={run} href={href} />
            ) : (
                <TemplesTable temples={temples} busy={busy} run={run} />
            )}

            <Pager offset={offset} pageSize={pageSize}
                   total={view === "groups" ? groups.total : temples.total} href={href} />
        </div>
    );
};

const Pager = ({ offset, pageSize, total, href }: {
    offset: number; pageSize: number; total: number;
    href: (patch: Record<string, string | number | undefined>) => string;
}) => {
    if (total <= pageSize) {
        return <p className="text-sm text-slate-500 mt-4">Всего: {total.toLocaleString("ru")}</p>;
    }
    const from = offset + 1, to = Math.min(offset + pageSize, total);
    return (
        <div className="flex items-center gap-3 text-sm mt-4">
            <span className="text-slate-500">{from.toLocaleString("ru")}–{to.toLocaleString("ru")} из {total.toLocaleString("ru")}</span>
            {offset > 0 && <Link href={href({ offset: Math.max(0, offset - pageSize) })}>← назад</Link>}
            {to < total && <Link href={href({ offset: offset + pageSize })}>вперёд →</Link>}
        </div>
    );
};

const GroupsTable = ({ groups, busy, run, href }: {
    groups: GroupPage;
    busy: string | null;
    run: (key: string, body: unknown, confirmText?: string) => void;
    href: (patch: Record<string, string | number | undefined>) => string;
}) => {
    if (!groups.items.length) return <p className="text-sm text-slate-500">Ничего не ждёт разбора.</p>;
    return (
        <div className="flex flex-col divide-y">
            {groups.items.map((g) => {
                const key = `${g.dedication}|${g.source}`;
                return (
                    <div key={key} className="flex flex-col gap-1 py-2">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                            <Link href={href({ view: "temples", dedication: g.dedication, offset: 0 })}
                                  className="font-medium hover:underline">{g.label}</Link>
                            <Kind kind={g.kind} />
                            <SourceBadge source={g.source} />
                            <span className="text-sm text-slate-600">{g.n.toLocaleString("ru")} шт.</span>
                            {g.main > 0 && <span className="text-xs text-slate-400">главных {g.main}</span>}
                            <span className="text-xs text-slate-400">уверенность {pct(g.low)}–{pct(g.high)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                            {g.patterns.length > 0 && <span className="font-mono">{g.patterns.join(", ")}</span>}
                            {g.sample && (
                                <span>напр. <Link href={`/temples/${g.sampleSlug}`} className="hover:underline">{g.sample}</Link></span>
                            )}
                            <span className="flex gap-2 ml-auto">
                                <Btn tone="ok" busy={busy === key + "a"} label={busy === key + "a" ? "…" : `принять ${g.n}`}
                                     onClick={() => run(key + "a",
                                         { action: "group", dedication: g.dedication, source: g.source, status: "approved" },
                                         `Принять все престолы «${g.label}» (${src(g.source)}), ${g.n} шт.?`)} />
                                <Btn tone="no" busy={busy === key + "r"} label={busy === key + "r" ? "…" : "отклонить"}
                                     onClick={() => run(key + "r",
                                         { action: "group", dedication: g.dedication, source: g.source, status: "rejected" },
                                         `Отклонить все престолы «${g.label}» (${src(g.source)}), ${g.n} шт.?`)} />
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const TemplesTable = ({ temples, busy, run }: {
    temples: { items: TempleFindings[]; total: number };
    busy: string | null;
    run: (key: string, body: unknown, confirmText?: string) => void;
}) => {
    if (!temples.items.length) return <p className="text-sm text-slate-500">Ничего не ждёт разбора.</p>;
    return (
        <div className="flex flex-col divide-y">
            {temples.items.map((t) => {
                const tkey = t.slug;
                const many = t.findings.length > 1;
                return (
                    <div key={t.slug} className="py-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                            <Link href={`/temples/${t.slug}`} className="font-medium hover:underline">{t.name}</Link>
                            {t.place && <span className="text-xs text-slate-500">{t.place}</span>}
                            {many && (
                                <span className="flex gap-2 ml-auto">
                                    <Btn tone="ok" busy={busy === tkey + "a"} label={busy === tkey + "a" ? "…" : `принять все ${t.findings.length}`}
                                         onClick={() => run(tkey + "a", { action: "temple", slug: t.slug, status: "approved" })} />
                                    <Btn tone="no" busy={busy === tkey + "r"} label={busy === tkey + "r" ? "…" : "отклонить все"}
                                         onClick={() => run(tkey + "r", { action: "temple", slug: t.slug, status: "rejected" })} />
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-1 mt-1">
                            {t.findings.map((f) => {
                                const key = `${t.slug}|${f.dedication}`;
                                return (
                                    <div key={f.dedication} className="flex flex-wrap items-baseline gap-x-2 text-sm pl-3">
                                        <span className="font-medium">{f.label}</span>
                                        {f.isMain && <span className="text-xs text-amber-700">главный</span>}
                                        <Kind kind={f.kind} />
                                        <SourceBadge source={f.source} />
                                        <span className="text-xs text-slate-400">{pct(f.confidence)}</span>
                                        {f.evidence?.phrase && (
                                            <span className="text-slate-500 italic">«{f.evidence.phrase}»</span>
                                        )}
                                        {f.evidence?.url && (
                                            <a href={f.evidence.url} target="_blank" rel="noopener noreferrer"
                                               className="text-xs text-blue-700 hover:underline">источник ↗</a>
                                        )}
                                        <span className="flex gap-2 ml-auto">
                                            <Btn tone="ok" busy={busy === key + "a"} label="принять"
                                                 onClick={() => run(key + "a", { action: "finding", slug: t.slug, dedication: f.dedication, status: "approved" })} />
                                            <Btn tone="no" busy={busy === key + "r"} label="отклонить"
                                                 onClick={() => run(key + "r", { action: "finding", slug: t.slug, dedication: f.dedication, status: "rejected" })} />
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default Content;
