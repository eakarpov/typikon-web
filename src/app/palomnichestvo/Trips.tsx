"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MAX_TRIP_DAYS, newTripId, tripDays, type TripStop } from "@/lib/pilgrimage/trip";
import { humanDate } from "@/app/pomyannik/labels";
import StopPicker from "./StopPicker";
import { loadTrips, storeTrips, type StoredTrip } from "./tripStore";

const INPUT = "border rounded px-2 py-1 bg-white";

const Trips = () => {
    const router = useRouter();
    const [trips, setTrips] = useState<StoredTrip[] | null>(null);
    const [title, setTitle] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [stops, setStops] = useState<TripStop[]>([]);
    const [error, setError] = useState("");

    useEffect(() => setTrips(loadTrips()), []);

    const create = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tripDays(from, to)) { setError(`Даты поездки: первый день не позже последнего, всего не больше ${MAX_TRIP_DAYS} дней.`); return; }
        const trip: StoredTrip = {
            id: newTripId(), title: title.trim() || `Поездка ${humanDate(from, false)}`,
            from, to, stops, createdAt: new Date().toISOString(),
        };
        if (!storeTrips([...(trips ?? []), trip])) { setError("Браузер не даёт сохранить поездку: хранилище сайта запрещено."); return; }
        router.push(`/palomnichestvo/poezdka?id=${trip.id}`);
    };

    const remove = (id: string) => {
        const next = (trips ?? []).filter((t) => t.id !== id);
        storeTrips(next);
        setTrips(next);
    };

    return (
        <div className="flex flex-col gap-6">
            {trips && !!trips.length && (
                <section>
                    <h2 className="font-serif text-lg">Ваши поездки</h2>
                    <ul className="font-serif">
                        {trips.map((t) => (
                            <li key={t.id} className="mb-1">
                                <Link className="text-amber-800 hover:underline" href={`/palomnichestvo/poezdka?id=${t.id}`}>{t.title}</Link>
                                <span className="text-slate-500 text-sm">
                                    {" "}— {humanDate(t.from, false)} – {humanDate(t.to)}
                                    {t.savedAt && " · сохранена для чтения без сети"}
                                </span>
                                <button type="button" className="ml-2 text-sm text-slate-400 hover:text-red-600"
                                        onClick={() => confirm(`Удалить поездку «${t.title}»?`) && remove(t.id)}>удалить</button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section>
                <h2 className="font-serif text-lg">Новая поездка</h2>
                <form onSubmit={create} className="font-serif grid gap-3 max-w-xl mt-2">
                    <label>Название (необязательно)
                        <input className={`${INPUT} w-full`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
                               placeholder="В Лавру к Преподобному" />
                    </label>
                    <div className="flex gap-3 flex-wrap">
                        <label>С <input type="date" className={INPUT} value={from} onChange={(e) => { setFrom(e.target.value); if (!to) setTo(e.target.value); }} required /></label>
                        <label>По <input type="date" className={INPUT} value={to} onChange={(e) => setTo(e.target.value)} required /></label>
                    </div>
                    <div>
                        <div className="mb-1">Храмы и места маршрута</div>
                        {!!stops.length && (
                            <ol className="list-decimal ml-5 mb-2">
                                {stops.map((s, i) => (
                                    <li key={`${s.kind}:${s.slug}`}>
                                        {s.name}
                                        <button type="button" className="ml-2 text-sm text-slate-400 hover:text-red-600"
                                                onClick={() => setStops(stops.filter((_, j) => j !== i))}>убрать</button>
                                    </li>
                                ))}
                            </ol>
                        )}
                        <StopPicker onPick={(s) => !stops.some((x) => x.kind === s.kind && x.slug === s.slug) && setStops([...stops, s])} />
                    </div>
                    {error && <p className="text-red-800 text-sm">{error}</p>}
                    <div>
                        <button type="submit" className="border border-amber-800 text-amber-900 rounded px-3 py-1 hover:bg-amber-50">
                            Собрать поездку
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
};

export default Trips;
