import Link from "next/link";
import clientPromise from "@/lib/mongodb";
import { normalizeQuery } from "@/lib/search";
import { dictionaryWord } from "@/lib/dictionaryWord";
import { reportError } from "@/lib/reportError";
import TextMarkup from "@/app/components/TextMarkup";

/** Supplement a grammatical headword with attributed interpretations. */
export default async function Encyclopedia({ word }: { word: string }) {
    if (!dictionaryWord(word)) return null;
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const books = await db.collection("books").find({ source: "wikisource:БЭАН", public: { $ne: false } }, { projection: { _id: 1 } }).toArray();
        const key = normalizeQuery(word).trim().replace(/ъ$/, "");
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rows = await db.collection("texts").find({ bookId: { $in: books.map(book => book._id) }, public: { $ne: false },
            searchName: { $regex: `^${escaped}(?:ъ)?(?:$|[^а-яёa-z])`, $options: "i" } },
        { projection: { alias: 1, name: 1, content: 1, footnotes: 1, newUi: 1 } }).sort({ name: 1 }).limit(6).toArray();
        if (!rows.length) return null;
        return <section className="font-serif space-y-3 border-t pt-3" aria-label="Толковательный справочник">
            <h2 className="font-bold text-lg">Толковательный справочник</h2>
            <p className="text-sm text-stone-600">Статьи с совпадающим заглавным словом из «Библейской энциклопедии» архимандрита Никифора.</p>
            {rows.slice(0, 5).map(row => <details key={row._id.toString()}>
                <summary className="cursor-pointer py-2">{row.name}</summary>
                <div className="space-y-2"><TextMarkup text={(row.content ?? "").slice(0, 800)} footnotes={row.footnotes ?? []} markdown={Boolean(row.newUi)} /></div>
                <Link className="underline inline-block py-2" href={`/reading/${row.alias || row._id}`}>Читать статью целиком →</Link>
            </details>)}
        </section>;
    } catch (error) {
        reportError(error, { where: "dictionary#Encyclopedia" });
        return <p className="font-serif text-sm">Толковательный справочник временно недоступен.</p>;
    }
}
