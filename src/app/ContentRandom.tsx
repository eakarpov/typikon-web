'use client';
import {BookOpenIcon, DocumentTextIcon} from "@heroicons/react/24/outline";
import FootnoteScope from "@/app/components/FootnoteScope";
import TextMarkup from "@/app/components/TextMarkup";
import Poems from "@/app/components/Poems";
import Link from "next/link";
import {useEffect, useState} from "react";

const ContentRandom = () => {
    const [item, setItem] = useState<any|null>(null);

    useEffect(() => {
        fetch("/api/v2/texts/random")
            .then((res) => (res.ok ? res.json() : null))
            .then((res) => {
                if (res?.id) setItem(res);
            })
            .catch(() => {
                // Блок на главной необязательный — молча не показываем.
            });
    }, []);

    if (!item) return null;

    return (
        <FootnoteScope content={item.content} poems={item.poems} footnotes={item.footnotes}>
        <div className="flex flex-col border border-slate-300 rounded p-1">
            <h3 className="text-xl text-center font-bold font-serif">Случайно выбранный текст</h3>
            <div className="flex flex-col pt-2 flex-1 border-t border-slate-300">
                <p className="text-1xl font-bold">
                    <span className="flex flex-row items-center">
                        <Link
                            href={`/library/${item.bookAlias || item.bookId}`}
                            aria-label="Открыть книгу"
                        >
                            <BookOpenIcon className="w-6 h-6" />
                        </Link>
                        {/* По alias, если он есть: страница чтения иначе сама перенаправит. */}
                        <Link href={`/reading/${item.alias || item.id}`} aria-label="Открыть текст">
                            <DocumentTextIcon className="w-6 h-6" />
                        </Link>
                        <span className="pr-2 font-serif">
                            {item.name}
                        </span>
                    </span>
                </p>
                <Poems value={item.poems} footnotes={item.footnotes} markdown={item.newUi} />
                <div className="space-y-1 mt-2">
                    <div className={`whitespace-pre-wrap text-justify text-lg ${item.csSource ? 'font-sans-serif' : 'font-serif'}`}>
                        <TextMarkup text={item.content.substring(0, 1000)} footnotes={item.footnotes} markdown={item.newUi} />
                        {item.content.length > 1000 && "…"}
                    </div>
                </div>
            </div>
        </div>
        </FootnoteScope>
    );
};

export default ContentRandom;
