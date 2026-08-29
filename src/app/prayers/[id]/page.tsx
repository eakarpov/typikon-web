import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrayer } from "@/lib/prayers";
import { myFont } from "@/utils/font";
import { BOOK_LABELS, PRAYER_KIND_LABELS, labelOf } from "@/utils/chantLabels";

export const dynamic = "force-dynamic";

export async function generateMetadata(
    { params }: { params: { id: string } },
): Promise<Metadata> {
    const p = getPrayer(params.id);
    if (!p) return { title: "Молитва не найдена — Уставные чтения" };
    return {
        title: `${p.title || "Молитва"} — ${p.owner} — Уставные чтения`,
        description: p.incipit,
    };
}

// Куда ведёт «при ком»: у молитвы акафиста — на сам акафист, у книжной —
// пока никуда: страницы памяти как таковой у нас нет, есть страница святого,
// а связь памяти со святым (memories.dneslov_id) ещё не заполнена.
const ownerHref = (kind: string, ownerId: string | null) =>
    kind === "akathist" && ownerId ? `/akathists/${ownerId}` : null;

const PrayerPage = ({ params }: { params: { id: string } }) => {
    const prayer = getPrayer(params.id);
    if (!prayer) notFound();

    const href = ownerHref(prayer.kind, prayer.ownerId);

    return (
        <div className={`${myFont.variable} pt-2`}>
            <Link href="/prayers" className="font-serif text-sm text-red-900">← к молитвам</Link>
            <h1 className="font-bold font-serif mt-2">{prayer.title || "Молитва"}</h1>
            <p className="text-sm text-slate-500 font-serif">
                {labelOf(PRAYER_KIND_LABELS, prayer.kind)}
                {prayer.owner && (
                    <>
                        {" · "}
                        {href
                            ? <Link href={href} className="text-red-900 hover:underline">{prayer.owner}</Link>
                            : prayer.owner}
                    </>
                )}
            </p>

            <p className="font-serif text-slate-800 mt-4 whitespace-pre-line">{prayer.text}</p>

            {prayer.siblings.length > 0 && (
                // Книга печатает молитвы вереницей — «Моли́тва пе́рвая»,
                // «Моли́тва втора́я», — и читателю, дочитавшему одну, нужна
                // следующая, а не возврат в общий список.
                <div className="mt-6 pt-3 border-t border-slate-300">
                    <p className="font-serif text-sm text-slate-500">Здесь же напечатаны:</p>
                    <ul className="mt-1">
                        {prayer.siblings.map(s => (
                            <li key={s.id}>
                                <Link href={`/prayers/${s.id}`} className="font-serif text-red-900">
                                    {s.title || `Молитва ${s.seq}`}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {prayer.sourceBook && (
                <p className="font-serif text-xs text-slate-500 mt-6">
                    Источник: {labelOf(BOOK_LABELS, prayer.sourceBook)}
                    {prayer.sourceUrl && (
                        <>
                            {" · "}
                            <a href={prayer.sourceUrl} className="text-red-900 underline"
                               target="_blank" rel="noopener noreferrer">
                                {prayer.sourceUrl}
                            </a>
                        </>
                    )}
                </p>
            )}
        </div>
    );
};

export default PrayerPage;
