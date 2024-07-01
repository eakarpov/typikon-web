'use client';
import {BookOpenIcon, DocumentTextIcon} from "@heroicons/react/24/outline";
import reactStringReplace from "react-string-replace";
import FootnoteLinkNew from "@/app/components/FootnoteLinkNew";
import Link from "next/link";
import {useEffect, useState} from "react";

const ContentRandom = () => {
    const [item, setItem] = useState<any|null>(null);

    useEffect(() => {
        fetch("/api/v1/library/random").then((res) => res.json()).then((res) => {
            setItem(res);
        })
    }, []);

    if (!item) return null;

    return (
        <div className="flex flex-col">
            <h3 className="text-xl font-bold">Случайно выбранный текст</h3>
            <div className="flex flex-col pt-2 flex-1">
                <p className="text-1xl font-bold">
                    <span className="flex flex-row items-center">
                        <Link
                            href={`/library/${item.bookId.toString()}`}
                        >
                            <BookOpenIcon className="w-6 h-6" />
                        </Link>
                        <Link href={`/reading/${item.id.toString()}`}>
                            <DocumentTextIcon className="w-6 h-6" />
                        </Link>
                        <span className="pr-2 font-serif">
                            {item.name}
                        </span>
                    </span>
                </p>
                {item.poems && (
                    <div className="space-y-1 mt-2">
                        <p className="font-serif">
                            <b>Стихи́:</b>
                        </p>
                        {item.poems?.split("\n").map((verse: string) => (
                            <p
                                key={verse}
                                className="whitespace-pre-wrap font-serif first-letter:text-red-600"
                            >
                                <i>
                                    {verse}
                                </i>
                            </p>
                        ))}
                    </div>
                )}
                <div className="space-y-1 mt-2">
                    {item.content.substring(0, 1000)?.split("\n\n").map((paragraph: string) => (
                        <p
                            key={paragraph}
                            className="whitespace-pre-wrap text-justify text-lg font-serif first-letter:text-red-600"
                        >

                            {reactStringReplace(
                                reactStringReplace(
                                    paragraph,
                                    /\{(\d+)}/g,
                                    (footnote) => <FootnoteLinkNew footnotes={item.footnotes} value={footnote} />,
                                ),
                                /\{k\|(.+)}/,
                                (red) => (
                                    <span key={red} className="text-red-600">
                                        {red}
                                    </span>
                                )
                            )}{item.content.length > 1000 && `...`}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ContentRandom;
