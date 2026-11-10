import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { resolvePericopeVersesWithFallback } from "@/lib/pericopes";
import { BIBLE_LANGUAGE_COOKIE, DEFAULT_BIBLE_LANGUAGE } from "@/utils/bibleLanguage";
import DayPartReading from "@/app/components/DayPartReading";
import { TextType } from "@/utils/texts";
import { getPublicPericopes, pericopeRangeHref, pericopeRangeLabel } from "@/lib/publicPericopes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
    const item = (await getPublicPericopes()).find(row => row.id === params.id);
    return { title: item ? `${item.label} — зачало Нового Завета` : "Зачало не найдено" };
}

export default async function Pericope({ params }: { params: { id: string } }) {
    if (!ObjectId.isValid(params.id)) notFound();
    const client = await clientPromise;
    const db = client.db("typikon");
    const row = await db.collection("pericopes").findOne({ _id: new ObjectId(params.id), source: { $in: ["gospel", "apostle"] } });
    if (!row) notFound();
    const language = cookies().get(BIBLE_LANGUAGE_COOKIE)?.value || DEFAULT_BIBLE_LANGUAGE;
    const resolved = await resolvePericopeVersesWithFallback(db, row, language);
    // Pass only serializable reading data to the client renderer.
    const pericope = { id: row._id.toString(), label: row.label, bookSlug: row.bookSlug, ranges: row.ranges,
        source: row.source, ...resolved };
    return <main className="font-serif py-4 space-y-3">
        <Link href="/pericopes" className="underline">← Все зачала</Link>
        <h1 className="font-bold text-xl">{row.label}</h1>
        <nav aria-label="Границы зачала">{(row.ranges ?? []).map((range: any, i: number) =>
            <Link key={i} className="underline mr-3 inline-block py-2" href={pericopeRangeHref(row.bookSlug, range, resolved?.editionCode ?? undefined)}>{pericopeRangeLabel(range)}</Link>)}</nav>
        <DayPartReading readingOnly valueName={row.source === "gospel" ? TextType.GOSPEL_LITURGY : TextType.APOSTLE_LITURGY} value={{ items: [{ pericope }] }} />
    </main>;
}
