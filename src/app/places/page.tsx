import { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import { SITE_URL } from "@/utils/site";
import { placesIndex } from "@/lib/places/query";
import { matches } from "@/lib/places/search";
import { KIND_LABELS } from "@/lib/places/labels";
import type { PlaceKind } from "@/lib/places/schema";
import IndexMap from "./IndexMap";

// Указатель мест: всё, у чего есть русское имя, — по алфавиту и на карте. Фильтры в
// адресе, а не в состоянии страницы: ссылку на «реки, упомянутые в Писании» можно
// переслать.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Места Писания и чтений",
    description: "Указатель библейских мест: имена по эпохам, где упоминаются в Писании и в чтениях, что было на этом месте прежде и что стало потом.",
    openGraph: { title: "Места Писания и чтений", url: `${SITE_URL}/places` },
};

type Props = { searchParams: { q?: string; kind?: string; scripture?: string } };

const hrefWith = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
    const s = search.toString();
    return s ? `/places?${s}` : "/places";
};

const PlacesIndex = async ({ searchParams }: Props) => {
    setMeta();
    const all = await placesIndex();
    const q = (searchParams.q ?? "").trim();
    const kind = searchParams.kind && searchParams.kind in KIND_LABELS ? searchParams.kind as PlaceKind : undefined;
    const scripture = searchParams.scripture === "1";

    const items = all.filter((p) =>
        matches(p.haystack, q)
        && (!kind || p.kind === kind)
        && (!scripture || p.scripture > 0));

    const kinds = [...new Set(all.map((p) => p.kind).filter(Boolean))] as PlaceKind[];
    const byLetter = new Map<string, typeof items>();
    for (const p of items) {
        const letter = p.name[0].toUpperCase();
        if (!byLetter.has(letter)) byLetter.set(letter, []);
        byLetter.get(letter)!.push(p);
    }
    const points = items.filter((p) => p.point).map((p) => ({
        lon: p.point![0], lat: p.point![1], name: p.name, href: p.href, scripture: p.scripture > 0,
    }));

    return (
        <div className={`pt-2 ${myFont.variable}`}>
            <h1 className="font-serif text-2xl">Места</h1>
            <p className="font-serif text-slate-600 mt-1">
                Места, названные в Писании и в чтениях. У каждого — имена по эпохам, отождествления с
                нынешними местами и стихи, где оно упомянуто. Есть и отдельная{" "}
                <Link href="/places/common" className="text-red-900 hover:underline">карта славянских поселений</Link>.
            </p>

            <form action="/places" className="font-serif flex flex-wrap items-center gap-2 mt-3">
                <input name="q" defaultValue={q} placeholder="Название" className="border border-slate-300 rounded px-2 py-1" />
                <select name="kind" defaultValue={kind ?? ""} className="border border-slate-300 rounded px-2 py-1">
                    <option value="">любого рода</option>
                    {kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>
                <label className="flex items-center gap-1">
                    <input type="checkbox" name="scripture" value="1" defaultChecked={scripture} /> упомянуты в Писании
                </label>
                <button type="submit" className="border border-slate-300 rounded px-3 py-1">Показать</button>
                {(q || kind || scripture) && <Link href="/places" className="text-slate-500 hover:underline">сбросить</Link>}
            </form>

            <p className="font-serif text-slate-500 mt-2">
                Мест: {items.length}{items.length !== all.length && ` из ${all.length}`}; на карте: {points.length}
            </p>

            {points.length > 0 && <div className="mt-2"><IndexMap points={points} /></div>}

            {byLetter.size > 1 && (
                <p className="font-serif text-sm mt-3 flex flex-wrap gap-x-2">
                    {[...byLetter.keys()].map((letter) => <a key={letter} href={`#letter-${letter}`} className="text-red-900 hover:underline">{letter}</a>)}
                </p>
            )}

            <div className="mt-2">
                {[...byLetter].map(([letter, list]) => (
                    <section key={letter} id={`letter-${letter}`} className="mt-3">
                        <h2 className="font-serif font-bold">{letter}</h2>
                        <ul className="font-serif columns-1 sm:columns-2 lg:columns-3">
                            {list.map((p) => (
                                <li key={p.id} className="break-inside-avoid">
                                    <Link href={p.href} className="text-red-900 hover:underline">{p.name}</Link>
                                    <span className="text-slate-500 text-sm">
                                        {p.kind && ` — ${KIND_LABELS[p.kind]}`}
                                        {p.scripture > 0 && `, в Писании: ${p.scripture}`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
            {!items.length && (
                <p className="font-serif text-slate-500 mt-3">
                    Ничего не нашлось. <Link href={hrefWith({})} className="text-red-900 hover:underline">Все места</Link>
                </p>
            )}
        </div>
    );
};

export default PlacesIndex;
