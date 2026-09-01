"use client";

import { useState } from "react";
import Link from "next/link";
import type { LinksData, LinkStatus, LinkTarget, SaintLink } from "./api";

// Просмотр связей «акафист — святой».
//
// Это НЕ разметка с нуля, а подтверждение: сопоставитель уже предложил
// святого, и от человека нужно «да» или поправка. Поэтому у каждой строки
// кнопка согласия стоит первой и работает одним нажатием, а выбор из
// альтернатив — рядом, чтобы не уходить со страницы за чужим списком.
//
// Замер, ради которого всё и затевалось: из 427 акафистов одному лицу 220
// сопоставились уверенно, 83 неоднозначно. Уверенные ошибаются редко, но
// ошибаются — «мученице Валентине Кесарийской» находило «Вале́нта
// Кесари́йского», другое лицо и другой пол. Ошибка в проставленной связи тише
// отсутствующей: она выглядит как факт. Отсюда и ревью.

const STATUS_LABELS: Record<string, string> = {
    pending: "ждут решения",
    approved: "подтверждены",
    rejected: "отклонены",
    all: "все",
};

const KIND_LABELS: Record<string, string> = {
    exact: "уверенно",
    ambiguous: "неоднозначно",
};

const dneslovHref = (id: string) => `https://dneslov.org/api/v0/memories/${id}.json`;

// Куда ведёт наша сторона связи. У памяти книги своей страницы нет — она
// живёт внутри службы, — поэтому ведём в поиск по песнопениям этой памяти:
// увидеть, что за служба, всё равно надо.
const subjectHref = (link: SaintLink) =>
    link.target === "akathist"
        ? `/akathists/${link.subjectId}`
        : `/chants?memory=${encodeURIComponent(link.subjectId)}&q=господи`;

const Row = ({ link, onDecide }: {
    link: SaintLink;
    onDecide: (id: string, status: LinkStatus, dneslovId?: string, saintName?: string) => void;
}) => {
    const [chosen, setChosen] = useState({ id: link.dneslovId, name: link.saintName });
    const decided = link.status !== "pending";

    return (
        <div className={`flex flex-col gap-1 border-b border-slate-200 py-2 ${decided ? "opacity-50" : ""}`}>
            <div className="flex flex-row flex-wrap items-baseline gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                    link.kind === "exact" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {KIND_LABELS[link.kind] ?? link.kind}
                </span>
                <span className="text-xs text-slate-400">{Math.round(link.score * 100)}%</span>
                {link.date && <span className="text-xs text-slate-400">{link.date}</span>}
                {/* ДАТА — ВТОРОЙ ГОЛОС, независимый от слов имени: сошёлся ли
                    день памяти святого с числом, под которым книга печатает
                    службу. Где голоса нет вовсе (святого нет в нашем каталоге),
                    молчим, а не показываем «не сошлось»: это разные вещи. */}
                {link.dateAgrees === true && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700"
                          title="день памяти святого совпал с числом книги">дата сошлась</span>
                )}
                {link.dateAgrees === false && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700"
                          title="день памяти святого не совпал с числом книги">дата мимо</span>
                )}
                {(link.sameSaint ?? 1) > 1 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-sky-100 text-sky-700"
                          title="этот же святой предложен и другим памятям — они стоят рядом">
                        ещё {(link.sameSaint ?? 1) - 1} памятям
                    </span>
                )}
                {link.approvedBy === "machine" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-600"
                          title="принято машиной по двойному согласию: имя и дата">машиной</span>
                )}
                <Link href={subjectHref(link)} target="_blank"
                      className="font-serif text-red-900 hover:underline">
                    {link.title}
                </Link>
            </div>

            <div className="flex flex-row flex-wrap items-baseline gap-2 pl-2">
                <span className="text-slate-400">→</span>
                <a href={dneslovHref(chosen.id)} target="_blank" rel="noreferrer"
                   className="font-serif text-amber-800 hover:underline">
                    {chosen.name || "(без имени)"}
                </a>
                <span className="text-xs text-slate-400">#{chosen.id}</span>

                {!decided && (
                    <>
                        <button
                            onClick={() => onDecide(link.id, "approved", chosen.id, chosen.name)}
                            className="text-sm border rounded px-2 py-0.5 bg-green-50 hover:bg-green-100"
                        >
                            подтвердить
                        </button>
                        <button
                            onClick={() => onDecide(link.id, "rejected")}
                            className="text-sm border rounded px-2 py-0.5 bg-slate-50 hover:bg-slate-100"
                        >
                            не тот
                        </button>
                    </>
                )}
                {decided && <span className="text-xs text-slate-500">{link.status}</span>}
            </div>

            {!decided && link.alternatives.length > 1 && (
                <div className="flex flex-row flex-wrap items-baseline gap-2 pl-6">
                    <span className="text-xs text-slate-400">или:</span>
                    {link.alternatives
                        .filter(a => a.dneslovId !== chosen.id)
                        .map(a => (
                            <button
                                key={a.dneslovId}
                                onClick={() => setChosen({ id: a.dneslovId, name: a.saintName })}
                                className="text-xs border rounded px-1.5 py-0.5 font-serif hover:bg-slate-100"
                                title={`${Math.round(a.score * 100)}%`}
                            >
                                {a.saintName || a.dneslovId}
                            </button>
                        ))}
                </div>
            )}
        </div>
    );
};

const Editor = ({ data, status, target }: { data: LinksData; status: string; target: LinkTarget }) => {
    const [items, setItems] = useState(data.items);
    const [busy, setBusy] = useState(false);

    const decide = async (id: string, next: LinkStatus, dneslovId?: string, saintName?: string) => {
        // Отмечаем сразу, не дожидаясь ответа: просмотр идёт быстро, и ждать
        // сеть на каждой строке — значит сделать его невыносимым. Ошибку
        // покажем, если она случится.
        setItems(prev => prev.map(i => (i.id === id ? { ...i, status: next } : i)));
        const res = await fetch(`/api/admin/akathists/${id}?target=${target}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: next, dneslovId, saintName }),
        });
        if (!res.ok) {
            setItems(prev => prev.map(i => (i.id === id ? { ...i, status: "pending" } : i)));
            alert(`Не сохранилось: ${res.status}`);
        }
    };

    /**
     * Подтвердить все уверенные разом.
     *
     * Даётся отдельной кнопкой и только для уверенных: у неоднозначных выбор
     * и есть вся работа, и делать его пачкой — то же, что не делать вовсе.
     */
    const approveAllExact = async () => {
        const targets = items.filter(i => i.status === "pending" && i.kind === "exact");
        if (!targets.length) return;
        if (!confirm(`Подтвердить ${targets.length} уверенных связей? Просмотрите их сначала.`)) return;
        setBusy(true);
        for (const t of targets) await decide(t.id, "approved", t.dneslovId, t.saintName);
        setBusy(false);
    };

    const pending = items.filter(i => i.status === "pending").length;

    return (
        <div className="flex flex-col gap-2">
            <h1 className="font-bold">Связи со святыми</h1>

            <div className="flex flex-row gap-2 items-baseline">
                {(["akathist", "memory"] as LinkTarget[]).map(t => (
                    <a key={t} href={`/admin/akathists?target=${t}&status=${status}`}
                       className={`text-sm px-2 py-0.5 rounded border ${
                           target === t ? "bg-slate-200" : "hover:bg-slate-50"}`}>
                        {t === "akathist" ? "акафисты" : "памяти книг"}
                    </a>
                ))}
            </div>
            <p className="text-sm text-slate-600">
                Сопоставитель предложил святого — от вас нужно подтверждение или поправка.
                Подтверждённое выгружается в правила корпуса командой{" "}
                <code>{target === "akathist" ? "npm run export:akathist-saints" : "npm run export:memory-saints"}</code>,
                и уже оттуда сборка проставляет{" "}
                <code>{target === "akathist" ? "akathists.dneslov_id" : "memories.dneslov_id"}</code>.
                Прямо в базу не пишем: она пересобирается с нуля.
            </p>

            <div className="flex flex-row flex-wrap gap-2 items-baseline">
                {["pending", "approved", "rejected", "all"].map(s => (
                    <a key={s} href={`/admin/akathists?target=${target}&status=${s}`}
                       className={`text-sm px-2 py-0.5 rounded border ${
                           status === s ? "bg-slate-200" : "hover:bg-slate-50"}`}>
                        {STATUS_LABELS[s]} {data.counts[s] !== undefined ? `(${data.counts[s]})` : ""}
                    </a>
                ))}
                <button
                    onClick={approveAllExact}
                    disabled={busy}
                    className="text-sm border rounded px-2 py-0.5 bg-green-50 hover:bg-green-100 disabled:opacity-50"
                >
                    подтвердить все уверенные на странице
                </button>
                <span className="text-sm text-slate-500">на странице ждут: {pending}</span>
            </div>

            <div className="flex flex-col mt-2">
                {items.map(link => <Row key={link.id} link={link} onDecide={decide} />)}
                {!items.length && <p className="text-slate-500">Здесь пусто.</p>}
            </div>
        </div>
    );
};

export default Editor;
