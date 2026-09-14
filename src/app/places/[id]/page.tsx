import { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { myFont, csFontVariables } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import { canonBook } from "@/utils/bibleCanon";
import { SITE_URL } from "@/utils/site";
import {
    getPlaceByAddress, nearbyTemples, placeArticles, placeRelations, placeScripture, placeTexts, saintsOfPlace,
    type PlaceRelationView,
} from "@/lib/places/query";
import { placeChants } from "@/lib/places/chants";
import {
    CONFIDENCE_LABELS, KIND_LABELS, langLabel, RELATION_LABELS, ROLE_LABELS, spanLabel, STATUS_LABELS,
} from "@/lib/places/labels";
import type { NameRole, PlaceName, RelationType } from "@/lib/places/schema";
import PlaceMap, { type MapPoint } from "./PlaceMap";

// Страница места: имена по эпохам, преемственность, отождествления, упоминания в
// Писании и в текстах корпуса. Адрес — наш слуг; прежние адреса (alias, _id), на
// которые ссылается разметка {pl|…} в текстах, уводят постоянным редиректом.

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const place = await getPlaceByAddress(params.id);
    if (!place || place.published === false) return { title: "Место не найдено" };
    const kind = place.kind ? KIND_LABELS[place.kind as keyof typeof KIND_LABELS] : "место";
    const title = `${place.name} — ${kind}`;
    const description = `${place.name}: имена по эпохам, где упоминается в Писании и в чтениях, что было на этом месте прежде и что стало потом.`;
    return {
        title,
        description,
        openGraph: { type: "website", url: `${SITE_URL}/places/${place.slug || params.id}`, title, description },
    };
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mt-6">
        <h2 className="font-serif text-lg font-bold mb-2">{title}</h2>
        {children}
    </section>
);

const PlaceLink = ({ place }: { place: { name: string; href: string | null } }) =>
    place.href
        ? <Link href={place.href} className="text-red-900 hover:underline">{place.name}</Link>
        : <span>{place.name}</span>;

const ROLE_ORDER: NameRole[] = ["biblical", "slavonic", "historical", "modern", "variant"];

/** Имена по ролям: в каждой — по времени, одинаковые имена разных источников — один раз. */
const Names = ({ names }: { names: PlaceName[] }) => {
    const groups = ROLE_ORDER
        .map((role) => {
            const seen = new Set<string>();
            const list = names
                .filter((n) => n.role === role)
                .sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity) || a.name.localeCompare(b.name))
                .filter((n) => {
                    const key = `${n.name}|${n.lang}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            return { role, list };
        })
        .filter((g) => g.list.length);
    if (!groups.length) return null;

    return (
        <Section title="Имена">
            <dl className="font-serif space-y-2">
                {groups.map(({ role, list }) => {
                    const body = (
                        <dd className="flex flex-wrap gap-x-4 gap-y-1">
                            {list.map((n, i) => (
                                <span key={i}>
                                    {n.name}
                                    <span className="text-slate-500 text-sm">
                                        {n.transliteration && ` (${n.transliteration})`}
                                        {langLabel(n.lang) && `, ${langLabel(n.lang)}`}
                                        {(n.from !== undefined || n.to !== undefined) && `, ${spanLabel(n.from, n.to)}`}
                                    </span>
                                </span>
                            ))}
                        </dd>
                    );
                    // Написаний у крупного места бывает по два десятка — их сворачиваем.
                    return role === "variant" && list.length > 6 ? (
                        <details key={role}>
                            <summary className="cursor-pointer text-slate-600">{ROLE_LABELS[role]} ({list.length})</summary>
                            {body}
                        </details>
                    ) : (
                        <div key={role}>
                            <dt className="text-slate-600">{ROLE_LABELS[role]}</dt>
                            {body}
                        </div>
                    );
                })}
            </dl>
        </Section>
    );
};

const RELATION_ORDER: RelationType[] = ["succeeds", "identified_with", "part_of", "located_in", "near"];

/** Преемственность и отождествления: исходящие и входящие связи, каждая своей строкой. */
const Continuity = ({ relations }: { relations: PlaceRelationView[] }) => {
    const rows = RELATION_ORDER.flatMap((type) => (["out", "in"] as const).map((direction) => ({
        type, direction,
        list: relations.filter((r) => r.type === type && r.direction === direction),
    }))).filter((r) => r.list.length);
    if (!rows.length) return null;

    return (
        <Section title="Преемственность и отождествления">
            <dl className="font-serif space-y-2">
                {rows.map(({ type, direction, list }) => (
                    <div key={`${type}-${direction}`}>
                        <dt className="text-slate-600">{RELATION_LABELS[type][direction]}</dt>
                        <dd className="flex flex-wrap gap-x-4 gap-y-1">
                            {list.slice(0, 40).map((r) => (
                                <span key={r.other.id}>
                                    <PlaceLink place={r.other} />
                                    {/* Достоверность нужна там, где её оспаривают: у отождествления
                                        и соседства; преемственность из Wikidata не спорная. */}
                                    {type !== "succeeds" && r.confidence !== "certain" && (
                                        <span className="text-slate-500 text-sm"> — {CONFIDENCE_LABELS[r.confidence]}</span>
                                    )}
                                </span>
                            ))}
                            {list.length > 40 && <span className="text-slate-500 text-sm">и ещё {list.length - 40}</span>}
                        </dd>
                    </div>
                ))}
            </dl>
        </Section>
    );
};

const externalLink = (source: string, id: string): { label: string; url: string } | null => {
    switch (source) {
        case "wikidata": return { label: `Wikidata ${id}`, url: `https://www.wikidata.org/wiki/${id}` };
        case "pleiades": return { label: `Pleiades ${id}`, url: `https://pleiades.stoa.org/places/${id}` };
        case "openbible": return {
            label: `OpenBible ${id}`,
            url: `https://www.openbible.info/geo/${id.startsWith("a") ? "ancient" : "modern"}/${id}`,
        };
        default: return null;
    }
};

const PlacePage = async ({ params }: Props) => {
    setMeta();
    const place = await getPlaceByAddress(params.id);
    if (!place || place.published === false) notFound();
    if (place.slug && place.slug !== decodeURIComponent(params.id)) permanentRedirect(`/places/${place.slug}`);

    const externals: { source: string; id: string }[] = place.externals ?? [];
    const articleAliases = externals.filter((e) => e.source === "nikifor").map((e) => e.id);
    const [lon, lat] = place.location?.coordinates ?? [];

    const [relations, scripture, texts, articles, temples, chants, saints] = await Promise.all([
        placeRelations(place.id),
        placeScripture(place.id),
        placeTexts(place.id, place.alias, articleAliases),
        placeArticles(articleAliases),
        place.location ? nearbyTemples(lon, lat) : Promise.resolve([]),
        placeChants(place.id),
        saintsOfPlace(place.id),
    ]);

    // Точки карты: своя и точки отождествлений — у древнего места без своей точки
    // карта держится на кандидатах.
    const points: MapPoint[] = [
        ...(place.location ? [{ lon, lat, label: place.name, kind: "self" as const }] : []),
        ...relations
            .filter((r) => r.other.location && (r.type === "identified_with" || r.type === "succeeds" || r.type === "located_in"))
            .map((r) => ({
                lon: r.other.location!.coordinates[0],
                lat: r.other.location!.coordinates[1],
                label: r.other.name,
                kind: (r.type === "identified_with" ? r.confidence : "related") as MapPoint["kind"],
            })),
    ];

    const kind = place.kind ? KIND_LABELS[place.kind as keyof typeof KIND_LABELS] : null;
    const status = place.status ? STATUS_LABELS[place.status as keyof typeof STATUS_LABELS] : null;
    const verseCount = scripture.books.reduce((s, b) => s + b.verses.length, 0);
    const sources = externals.map((e) => externalLink(e.source, e.id)).filter(Boolean) as { label: string; url: string }[];

    return (
        <div className={`pt-2 ${myFont.variable}`}>
            <div className="font-serif text-sm"><Link href="/places" className="text-red-900">← к указателю мест</Link></div>
            <h1 className="font-serif text-2xl mt-1">{place.name}</h1>
            <p className="font-serif text-slate-500">
                {[kind, status].filter(Boolean).join("; ")}
                {verseCount > 0 && `${kind || status ? "; " : ""}упоминается в Писании: ${verseCount}`}
            </p>
            {place.description && <p className="font-serif mt-2">{place.description}</p>}

            {(points.length > 0 || place.line) && (
                <div className="mt-4"><PlaceMap points={points} line={place.line?.coordinates} name={place.name} /></div>
            )}
            {!place.location && points.length > 0 && (
                <p className="font-serif text-sm text-slate-500 mt-1">
                    Своей точки у места нет: на карте — места, с которыми его отождествляют; чем бледнее точка, тем меньше уверенности.
                </p>
            )}

            {articles.length > 0 && (
                <Section title="Библейская энциклопедия">
                    <ul className="font-serif">
                        {articles.map((a) => (
                            <li key={a.id}>
                                <Link href={`/reading/${a.alias ?? a.id}`} className="text-red-900 hover:underline">{a.name}</Link>
                                <span className="text-slate-500 text-sm"> — архим. Никифор, 1891</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            <Names names={place.names ?? []} />

            {!!place.periods?.length && (
                <Section title="Эпохи">
                    <ul className="font-serif flex flex-wrap gap-x-4">
                        {place.periods.map((p: any, i: number) => (
                            <li key={i}>{p.label}<span className="text-slate-500 text-sm"> ({spanLabel(p.from, p.to)})</span></li>
                        ))}
                    </ul>
                </Section>
            )}

            <Continuity relations={relations} />

            {verseCount > 0 && (
                <Section title="В Священном Писании">
                    <div className="space-y-1">
                        {scripture.books.map((book) => (
                            <details key={book.canonId} className="font-serif">
                                <summary className="cursor-pointer">
                                    {book.name} <span className="text-slate-500">({book.verses.length})</span>
                                </summary>
                                <ul className={`mt-1 mb-2 space-y-1 ${csFontVariables}`}>
                                    {book.verses.map((v) => (
                                        <li key={v.canonRef}>
                                            <Link href={`/bible/${book.canonId}/${v.chapter}#v${v.verse}`}
                                                  className="font-serif text-red-900 hover:underline mr-2 whitespace-nowrap">
                                                {canonBook(book.canonId)?.abbr} {v.chapter}:{v.verse}
                                            </Link>
                                            <span className="font-sans-serif">{v.context}</span>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        ))}
                    </div>
                    {scripture.pending > 0 && (
                        <p className="font-serif text-sm text-slate-500 mt-2">
                            Ещё {scripture.pending} стихов ждут сверки: имя в них не нашлось в славянском тексте (местоимение, иное чтение).
                        </p>
                    )}
                </Section>
            )}

            {texts.length > 0 && (
                <Section title="В чтениях">
                    <ul className="font-serif">
                        {texts.map((t) => (
                            <li key={t.id}>
                                <Link href={`/reading/${t.alias ?? t.id}`} className="text-red-900 hover:underline">{t.name}</Link>
                                {t.book && <span className="text-slate-500 text-sm"> — {t.book}</span>}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {chants.total > 0 && (
                <Section title="В песнопениях">
                    <p className="font-serif text-sm text-slate-500 mb-1">
                        Упоминаний: {chants.total}{chants.items.length < chants.total && `; ниже — ${chants.items.length} разных текстов`}.
                    </p>
                    <ul className="space-y-2">
                        {chants.items.map((c) => (
                            <li key={c.id} className="font-serif">
                                <Link href={`/chants/${c.id}`} className="text-red-900 hover:underline">{c.unit}</Link>
                                {c.memory && <span className="text-slate-500 text-sm"> — {c.memory}</span>}
                                <div className="text-sm">«…{c.context}…»</div>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {saints.length > 0 && (
                <Section title="Святые">
                    <p className="font-serif text-sm text-slate-500 mb-1">
                        Место названо в чтениях к памяти этих святых — в житии, похвальном слове. Это не
                        обязательно родина или кафедра: в житии называют и места, где святой не бывал.
                    </p>
                    <ul className="font-serif flex flex-wrap gap-x-4">
                        {saints.map((s) => (
                            <li key={s.dneslovId}>
                                <Link href={s.href} className="text-amber-800 hover:underline">{s.name}</Link>
                                {s.texts > 1 && <span className="text-slate-500 text-sm"> ({s.texts})</span>}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {temples.length > 0 && (
                <Section title="Храмы рядом">
                    <ul className="font-serif">
                        {temples.map((t) => (
                            <li key={t.slug}>
                                <Link href={`/temples/${t.slug}`} className="text-amber-800 hover:underline">{t.name}</Link>
                                <span className="text-slate-500 text-sm"> — {t.distanceKm} км</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {(sources.length > 0 || place.links?.length > 0) && (
                <Section title="Источники">
                    <ul className="font-serif text-sm flex flex-wrap gap-x-4">
                        {sources.map((s) => (
                            <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-red-900 hover:underline">{s.label}</a></li>
                        ))}
                        {(place.links ?? []).map((l: any) => (
                            <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" className="text-red-900 hover:underline">{l.text || l.url}</a></li>
                        ))}
                    </ul>
                    <p className="font-serif text-xs text-slate-500 mt-2">
                        Данные о местах: OpenBible.info Bible Geocoding (CC BY 4.0), Pleiades (CC BY 3.0), Wikidata (CC0);
                        статьи — «Библейская энциклопедия» архим. Никифора (1891, общественное достояние).
                    </p>
                </Section>
            )}
        </div>
    );
};

export default PlacePage;
