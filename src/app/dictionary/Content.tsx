import React from "react";
import Link from "next/link";
import type { Found } from "@/app/dictionary/api";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<[Found[] | null, string | null]> }) => {
    const [items, error] = await itemsPromise;

    if (error) return <p className="font-serif text-slate-600">{error}</p>;

    if (!items?.length) {
        return (
            <p className="font-serif text-slate-600">
                Ничего не нашлось. Слово ищется по началу, поэтому «глагол» найдёт и
                «глаго́лати», и «глаго́ливый», — а вот по середине слова поиск не идёт.
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-1">
            {items.map((item) => (
                <li key={item.id} className="font-serif">
                    <Link href={`/dictionary/${item.id}`} className="underline underline-offset-4">
                        {item.name}
                    </Link>
                    {item.pos && <span className="text-slate-500 text-sm">{" — "}{item.pos}</span>}
                </li>
            ))}
        </ul>
    );
};

export default Content;
