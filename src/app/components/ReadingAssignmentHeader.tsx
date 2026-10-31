'use client';
import React from "react";
import Link from "next/link";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { readingStatia } from "@/lib/readingParts";

export function ReadingAssignmentNote({ cite, title }: { cite?: string; title: string }) {
    if (!cite?.trim()) return null;
    return <details className="min-w-0 max-w-full font-serif text-sm" onKeyDown={event => {
        if (event.key === "Escape" && event.currentTarget.open) {
            event.preventDefault();
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
        }
    }}>
        <summary className="min-h-11 w-fit max-w-full cursor-pointer rounded px-2 py-3 text-amber-900 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800">
            Пояснение назначения<span className="sr-only">: {title}</span>
        </summary>
        <p className="mt-1 whitespace-pre-wrap break-words rounded border-l-2 border-amber-800 bg-stone-50 p-3 text-stone-800">
            <strong>Типикон:</strong> {cite}
        </p>
    </details>;
}

export default function ReadingAssignmentHeader({ text, statia, cite }: { text: any; statia?: number; cite?: string }) {
    const title = text.name?.trim() || text.start?.trim()
        || (text.book?.name ? `Чтение из книги «${text.book.name}»` : "Чтение");
    const part = readingStatia(text.content ?? "", statia);
    const address = text.alias || text.id || text._id;
    return <header className="min-w-0 space-y-1 font-serif">
        <h3 className="break-words text-lg font-semibold text-stone-900">{title}</h3>
        {text.book?.name && <p className="break-words text-sm text-stone-600">
            {text.book.name}{Number(text.bookIndex) > 0 && ` · № ${text.bookIndex}`}
        </p>}
        {part && <p className="text-sm font-semibold text-red-700">{part}</p>}
        <div className="flex flex-wrap items-start gap-x-3">
            {address && <Link href={`/reading/${encodeURIComponent(String(address))}`}
                aria-label={`Открыть полный текст: ${title}`}
                className="inline-flex min-h-11 items-center gap-2 rounded px-2 py-3 text-sm text-amber-900 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800">
                <BookOpenIcon aria-hidden="true" className="h-5 w-5 shrink-0" />Полный текст
            </Link>}
            <ReadingAssignmentNote cite={cite} title={`${title}${part ? `, ${part}` : ""}`} />
        </div>
    </header>;
}
