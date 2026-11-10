import Link from "next/link";
import { getPublicPericopes, pericopeBookName, pericopeRangeLabel } from "@/lib/publicPericopes";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({ title: "Зачала Нового Завета", description: "Евангельские и апостольские зачала: номера, границы стихов и тексты чтений.", path: "/pericopes" });

export default async function Pericopes({ searchParams }: { searchParams: { book?: string; source?: string; q?: string } }) {
    const all = await getPublicPericopes();
    const books = [...new Set(all.map(p => p.bookSlug))];
    const query = (searchParams.q ?? "").trim().toLocaleLowerCase("ru");
    const items = all.filter(p => (!searchParams.book || p.bookSlug === searchParams.book)
        && (!searchParams.source || p.source === searchParams.source)
        && (!query || `${p.label} ${p.number} ${pericopeBookName(p.bookSlug)}`.toLocaleLowerCase("ru").includes(query)));
    return <main className="font-serif space-y-4 py-4">
        <Link className="underline" href="/bible">← Библия</Link>
        <h1 className="text-xl font-bold">Зачала Нового Завета</h1>
        <form className="flex flex-wrap gap-3" action="/pericopes">
            <label>Раздел <select name="source" defaultValue={searchParams.source ?? ""} className="border p-2"><option value="">Все</option><option value="gospel">Евангелие</option><option value="apostle">Апостол</option></select></label>
            <label>Книга <select name="book" defaultValue={searchParams.book ?? ""} className="border p-2"><option value="">Все</option>{books.map(book => <option key={book} value={book}>{pericopeBookName(book)}</option>)}</select></label>
            <label>Номер или название <input name="q" defaultValue={searchParams.q} className="border p-2" /></label>
            <button className="border rounded p-2">Найти</button>
        </form>
        <p>Найдено: {items.length}</p>
        <ul className="space-y-3">{items.map(p => <li key={p.id}>
            <Link className="underline block py-2" href={`/pericopes/${p.id}`}>{p.label} · {pericopeBookName(p.bookSlug)}</Link>
            <span>{p.ranges.map(pericopeRangeLabel).join(", ")}</span>
        </li>)}</ul>
    </main>;
}
