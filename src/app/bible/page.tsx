import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import { getBibleIndex } from "@/app/bible/api";

export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Библия — Уставные чтения",
    description:
        "Библия по книгам и главам: церковнославянская Елизаветинская и румынская 1688 года, " +
        "с возможностью читать издания рядом, стих против стиха.",
    openGraph: {
        type: "website",
        url: "//www.typikon.su/bible",
        title: "Библия — Уставные чтения",
        description: "Книги Библии по главам, с параллельным чтением изданий.",
    },
};

const Index = async () => {
    const { editions, sections } = await getBibleIndex();
    // Все издания разом — по такой ссылке раздел и открывается параллельным видом.
    const all = editions.map((edition) => edition.code).join(",");

    return (
        <div className="pt-2 space-y-4">
            <p className="font-serif">
                Библия по книгам и главам. Издания можно читать рядом: стихи сводятся по
                каноническому месту, а не по номеру строки, поэтому напротив славянского стиха
                стоит тот же стих румынского — даже там, где издания разбили текст по-разному.
            </p>

            <div className="font-serif">
                <p className="font-bold">Издания</p>
                <ul className="mt-1 space-y-1">
                    {editions.map((edition) => (
                        <li key={edition.code}>
                            <Link href={`/bible/bytie/1?v=${edition.code}`} className="text-red-900">
                                {edition.title}
                            </Link>
                            {edition.year && <span className="text-slate-500"> — {edition.year}</span>}
                        </li>
                    ))}
                </ul>
                {editions.length > 1 && (
                    <p className="mt-2">
                        <Link href={`/bible/bytie/1?v=${all}`} className="text-red-900">
                            Читать издания рядом →
                        </Link>
                    </p>
                )}
            </div>

            {sections.map((section) => (
                <div key={section.id} className="font-serif">
                    <p className="font-bold text-red-900">{section.label}</p>
                    <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
                        {section.books.map((book) => (
                            <li key={book.id}>
                                <Link href={`/bible/${book.id}/1`} className="hover:text-red-900">
                                    {book.name}
                                </Link>
                                {book.chapters > 0 && (
                                    <span className="text-slate-400 text-sm"> · {book.chapters}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
};

const BiblePage = () => (
    <div className={myFont.variable}>
        <Suspense fallback={<div>Loading...</div>}>
            <Index />
        </Suspense>
    </div>
);

export default BiblePage;
