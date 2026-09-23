import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { myFont } from "@/utils/font";
import { todayCivil } from "@/lib/trapeza/core";
import { knownTimeZone } from "@/lib/push/zones";
import { nearby } from "@/lib/pilgrimage/nearby";
import { formatDistance, parsePoint, RADII_KM } from "@/lib/pilgrimage/summary";
import { humanDate } from "@/app/pomyannik/labels";
import RelicLine from "@/app/components/RelicLine";
import Locate from "./Locate";
import MapLazy from "./MapLazy";

// Что рядом: кто почитается в храмах вокруг и чьи святыни поблизости.
//
// ПОСВЯЩЕНИЕ — НЕ МОЩИ. Никольский храм говорит, что здесь почитают святителя,
// но не что здесь его мощи; и то и другое показывается, но порознь и под
// разными словами. Святыни берутся только из реестра, каждая с источником.
//
// Точка приходит адресом (?lat&lon&r), уже огрублённая до километра: страницей
// можно поделиться, а в журналах сервера остаётся клетка, а не подъезд.

type Props = { searchParams: { lat?: string; lon?: string; r?: string } };

export const generateMetadata = ({ searchParams }: Props): Metadata => ({
    title: "Что рядом: святые, престолы и святыни — Уставные чтения",
    description: "Храмы вокруг и их престолы, ближайшие престольные праздники, святыни с источником сведений.",
    // Страница с точкой — чья-то точка: в поиск её незачем.
    ...(searchParams.lat ? { robots: { index: false, follow: false } } : {}),
});

const more = "text-amber-800 hover:underline";

const RyadomPage = async ({ searchParams }: Props) => {
    const point = parsePoint(searchParams.lat, searchParams.lon, searchParams.r);
    const radiusKm = point?.radiusKm ?? 15;

    const rawZone = decodeURIComponent(cookies().get("tz")?.value ?? "");
    const today = todayCivil(rawZone && knownTimeZone(rawZone) ? rawZone : "Europe/Moscow");
    const data = point ? await nearby(point.lat, point.lon, point.radiusKm, today) : null;

    const mapTemples = data
        ? [...new Map([
            ...data.dedications.flatMap((d) => d.temples),
            ...data.unparsed,
        ].map((t) => [t.slug, { slug: t.slug, name: t.name, lat: t.lat, lon: t.lon }])).values()]
        : [];
    const mapRelics = (data?.relics ?? []).map((r) => ({
        templeSlug: r.templeSlug ?? null, name: r.saintName,
        lat: r.location.coordinates[1], lon: r.location.coordinates[0],
    }));

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-5 max-w-3xl`}>
            <div>
                <h1 className="font-bold font-serif">Что рядом</h1>
                <p className="font-serif text-slate-700 mt-1">
                    Святые, которым посвящены престолы храмов вокруг, ближайшие престольные праздники
                    и святыни — мощи и их части — с указанием, откуда это известно.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
                <Locate radiusKm={radiusKm} />
                {point && (
                    <div className="font-serif text-sm text-slate-600">
                        Радиус:{" "}
                        {RADII_KM.map((r) => (
                            <span key={r} className="mr-2">
                                {r === radiusKm
                                    ? <b>{r} км</b>
                                    : <Link className={more} href={`/ryadom?lat=${point.lat}&lon=${point.lon}&r=${r}`}>{r} км</Link>}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <MapLazy center={point ? { lat: point.lat, lon: point.lon } : null} radiusKm={radiusKm}
                     temples={mapTemples} relics={mapRelics} />

            {!point && (
                <p className="font-serif text-slate-600">
                    Определите своё место или щёлкните по карте. Место огрубляется до километра и
                    нигде не хранится.
                </p>
            )}

            {data && (
                <>
                    <section>
                        <h2 className="font-serif text-lg">Святыни</h2>
                        {data.relics.length ? (
                            <ul className="mt-1">
                                {data.relics.map((r) => (
                                    <RelicLine key={r.id} relic={r} distance={formatDistance(r.distanceKm)} />
                                ))}
                            </ul>
                        ) : (
                            <p className="font-serif text-slate-600 text-sm mt-1">
                                В реестре святынь в этом радиусе записей нет. Реестр только заводится, и
                                отсутствие записи не значит отсутствия святыни.
                            </p>
                        )}
                    </section>

                    <section>
                        <h2 className="font-serif text-lg">Престолы храмов вокруг</h2>
                        <p className="font-serif text-slate-500 text-sm">
                            {data.templeCount} храмов в {radiusKm} км
                            {data.truncated && " (свод по ближайшим трёмстам)"}. Престол почти везде выведен
                            из названия храма и приделов не знает; святой при посвящении назван там, где связь
                            проверена.
                        </p>
                        <ul className="mt-2">
                            {data.dedications.map((d) => (
                                <li key={d.slug} className="font-serif mb-3">
                                    <Link className={`${more} font-semibold`} href={`/dedications/${d.slug}`}>{d.short}</Link>
                                    {!!d.saints.length && (
                                        <span className="text-slate-700">
                                            {" — "}
                                            {d.saints.map((s, i) => (
                                                <span key={s.name}>
                                                    {i > 0 && ", "}
                                                    {s.slug ? <Link className={more} href={`/saints/${s.slug}`}>{s.name}</Link> : s.name}
                                                </span>
                                            ))}
                                        </span>
                                    )}
                                    {d.next && (
                                        <div className="text-sm text-slate-600">
                                            Престольный праздник — {humanDate(d.next.date, false)}
                                            {d.next.date === today && <b> (сегодня)</b>}
                                            {d.next.movable && " (подвижный)"}
                                        </div>
                                    )}
                                    <div className="text-sm">
                                        {d.temples.slice(0, 4).map((t, i) => (
                                            <span key={t.slug}>
                                                {i > 0 && "; "}
                                                <Link className={more} href={`/temples/${t.slug}`}>{t.name}</Link>
                                                <span className="text-slate-500"> · {formatDistance(t.distanceKm)}</span>
                                            </span>
                                        ))}
                                        {d.temples.length > 4 && (
                                            <span className="text-slate-500"> и ещё {d.temples.length - 4}</span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {!!data.unparsed.length && (
                            <p className="font-serif text-sm text-slate-500">
                                Ещё рядом, престол не разобран:{" "}
                                {data.unparsed.slice(0, 10).map((t, i) => (
                                    <span key={t.slug}>
                                        {i > 0 && "; "}
                                        <Link className={more} href={`/temples/${t.slug}`}>{t.name}</Link>
                                    </span>
                                ))}.
                            </p>
                        )}
                    </section>

                    {!!data.places.length && (
                        <section>
                            <h2 className="font-serif text-lg">Места из чтений</h2>
                            <ul className="mt-1">
                                {data.places.map((p) => (
                                    <li key={p.id} className="font-serif mb-1">
                                        <Link className={more} href={p.href}>{p.name}</Link>
                                        <span className="text-slate-500 text-sm"> · {formatDistance(p.distanceKm)}</span>
                                        {!!p.saints.length && (
                                            <div className="text-sm text-slate-600">
                                                Упомянуто в чтениях памяти:{" "}
                                                {p.saints.slice(0, 5).map((s, i) => (
                                                    <span key={s.dneslovId}>
                                                        {i > 0 && ", "}
                                                        <Link className={more} href={s.href}>{s.name}</Link>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <p className="font-serif">
                        <Link className={more} href="/palomnichestvo">Собрать поездку</Link>
                        <span className="text-slate-500 text-sm"> — даты и храмы маршрута, и чтения на все её дни без сети</span>
                    </p>
                </>
            )}
        </div>
    );
};

export default RyadomPage;
