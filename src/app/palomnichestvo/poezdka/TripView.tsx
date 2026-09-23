"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { currentPageUrl, formatBytes, isSupported, plural, saveMany, type SaveProgress } from "@/lib/offline";
import { estimateBytes } from "@/lib/pilgrimage/trip";
import type { Plan } from "@/lib/pilgrimage/plan";
import { humanDate, weekdayOf } from "@/app/pomyannik/labels";
import RelicLine from "@/app/components/RelicLine";
import { loadTrips, updateTrip, type StoredTrip } from "../tripStore";

// Поездка по дням. Состав спрашивается у сервера, пока есть сеть, и
// запоминается вместе с поездкой: без сети страница показывает последний
// состав, а не пустоту.

const more = "text-amber-800 hover:underline";

const TripView = () => {
    const id = useSearchParams()?.get("id") ?? "";
    const [trip, setTrip] = useState<StoredTrip | null | undefined>(undefined);
    const [planError, setPlanError] = useState("");
    const [progress, setProgress] = useState<SaveProgress | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [free, setFree] = useState<number | null>(null);

    useEffect(() => {
        const found = loadTrips().find((t) => t.id === id) ?? null;
        setTrip(found);
        if (!found) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        fetch("/api/pilgrimage/plan", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: found.from, to: found.to, stops: found.stops.map(({ kind, slug }) => ({ kind, slug })) }),
        })
            .then(async (r) => {
                const json = await r.json();
                if (!r.ok) throw new Error(json?.error ?? `ошибка ${r.status}`);
                return json as Plan;
            })
            .then((plan) => setTrip(updateTrip(found.id, { plan, planAt: new Date().toISOString() })))
            .catch((e) => setPlanError(found.plan ? "" : String(e.message ?? e)));
        navigator.storage?.estimate?.()
            .then((e) => setFree(e.quota !== undefined && e.usage !== undefined ? e.quota - e.usage : null))
            .catch(() => {});
    }, [id]);

    const save = useCallback(async () => {
        if (!trip?.plan) return;
        setSaving(true);
        setSaveError("");
        // Просим браузер не вычищать сохранённое при нехватке места: в дороге
        // обнаружить, что чтения стёрты, — хуже, чем не сохранить вовсе.
        await navigator.storage?.persist?.().catch(() => false);
        const items = [...trip.plan.save, { url: currentPageUrl(), label: `Поездка «${trip.title}»` }];
        const answer = await saveMany(items, trip.id, setProgress);
        setSaving(false);
        if (!answer.ok) { setSaveError(answer.error); return; }
        setTrip(updateTrip(trip.id, { savedAt: new Date().toISOString(), failed: answer.failed ?? [] }));
    }, [trip]);

    if (trip === undefined) return <p className="font-serif text-slate-500">Открываю поездку…</p>;
    if (!trip) {
        return (
            <p className="font-serif text-slate-600">
                Такой поездки в этом браузере нет. Поездки хранятся только там, где их собрали.{" "}
                <Link className={more} href="/palomnichestvo">Собрать поездку</Link>
            </p>
        );
    }

    const plan = trip.plan;
    const pages = (plan?.save.length ?? 0) + 1;

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="font-bold font-serif">{trip.title}</h1>
                <p className="font-serif text-slate-600 text-sm">
                    {humanDate(trip.from, false)} – {humanDate(trip.to)}
                    {" · "}<Link className={more} href="/palomnichestvo">все поездки</Link>
                </p>
            </div>

            <section className="font-serif border rounded p-3 bg-amber-50/40">
                {trip.savedAt ? (
                    <p>
                        Сохранена для чтения без сети {humanDate(trip.savedAt.slice(0, 10))}.
                        {!!trip.failed?.length && <span className="text-red-800"> Не далось страниц: {trip.failed.length}.</span>}
                        {" "}Убрать сохранённое можно в <Link className={more} href="/settings">настройках</Link>.
                    </p>
                ) : (
                    <p>
                        Чтения на все дни, страницы храмов и святых маршрута —{" "}
                        {pages} {plural(pages, "страница", "страницы", "страниц")}, около {formatBytes(estimateBytes(pages))}
                        {free !== null && free < estimateBytes(pages) * 2 && (
                            <span className="text-red-800"> (свободно всего {formatBytes(free)})</span>
                        )}.
                    </p>
                )}
                {!isSupported() ? (
                    <p className="text-sm text-slate-600 mt-1">Этот браузер не умеет сохранять страницы для чтения без сети.</p>
                ) : (
                    <div className="mt-2">
                        <button type="button" disabled={!plan || saving} onClick={save}
                                className="border border-amber-800 text-amber-900 rounded px-3 py-1 hover:bg-amber-50 disabled:opacity-60">
                            {saving ? "Сохраняю…" : trip.savedAt ? "Сохранить заново" : "Сохранить для чтения без сети"}
                        </button>
                        {saving && progress && (
                            <span className="ml-3 text-sm text-slate-600">{progress.done} из {progress.total}</span>
                        )}
                        {saveError && <p className="text-sm text-red-800 mt-1">Не удалось: {saveError}.</p>}
                    </div>
                )}
            </section>

            {!plan && (
                <p className="font-serif text-slate-600">
                    {planError ? `Состав поездки не собрался: ${planError}.` : "Собираю состав поездки…"}
                </p>
            )}
            {plan && trip.planAt && typeof navigator !== "undefined" && !navigator.onLine && (
                <p className="font-serif text-sm text-slate-500">Нет сети: показан состав от {humanDate(trip.planAt.slice(0, 10))}.</p>
            )}

            {plan && (
                <>
                    <section>
                        <h2 className="font-serif text-lg">По дням</h2>
                        <ol className="font-serif mt-1">
                            {plan.days.map((d) => (
                                <li key={d.date} className="mb-3">
                                    <div>
                                        <b>{humanDate(d.date, false)}</b>, {weekdayOf(d.date)}
                                        {" · "}<Link className={more} href={`/calculator/${d.date}`}>чтения дня</Link>
                                    </div>
                                    {d.title && <div className="text-slate-700">{d.title}</div>}
                                    {d.feasts.map((f) => (
                                        <div key={f.href + f.label} className="text-sm text-red-900">
                                            Престольный праздник: {f.label} — <Link className={more} href={f.href}>{f.stop}</Link>
                                        </div>
                                    ))}
                                    {d.memories.map((m) => (
                                        <div key={m.name + m.why} className="text-sm text-red-900">
                                            Память: {m.href ? <Link className={more} href={m.href}>{m.name}</Link> : m.name}
                                            <span className="text-slate-500"> ({m.why})</span>
                                        </div>
                                    ))}
                                </li>
                            ))}
                        </ol>
                    </section>

                    {!!plan.stops.length && (
                        <section>
                            <h2 className="font-serif text-lg">Маршрут</h2>
                            <ol className="font-serif list-decimal ml-5 mt-1">
                                {plan.stops.map((s) => (
                                    <li key={s.href} className="mb-2">
                                        <Link className={more} href={s.href}>{s.name}</Link>
                                        {!!s.dedications.length && (
                                            <span className="text-sm text-slate-500"> — престолы: {s.dedications.join(", ")}</span>
                                        )}
                                        {!!s.relics.length && (
                                            <ul className="mt-1">{s.relics.map((r) => <RelicLine key={r.id} relic={r} showSite={false} />)}</ul>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}
                </>
            )}
        </div>
    );
};

export default TripView;
