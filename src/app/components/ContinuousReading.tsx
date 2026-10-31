import React from "react";
import Link from "next/link";
import { continuousReadingView } from "@/lib/continuousReading";

export default function ContinuousReading({ value }: { value: unknown }) {
    const reading = continuousReadingView(value);
    if (!reading) return null;
    return <div className="font-serif space-y-2">
        <p><Link href={reading.href} className="text-amber-800 underline underline-offset-4">
            {reading.label} — {reading.fromChapter === undefined ? "продолжение чтения"
                : reading.fromChapter === 1 ? "читать с начала" : `читать с главы ${reading.fromChapter}`}
        </Link></p>
        <p className="text-sm text-stone-600">
            {reading.fromChapter === undefined
                ? "Продолжайте с места, на котором остановились. Начальная и конечная границы фрагмента в этом указании Типикона не названы."
                : "Последовательное чтение книги. Конечная граница в этом указании Типикона не названа."}
        </p>
        <p className="text-sm"><a href={reading.sourceUrl} target="_blank" rel="noreferrer"
            className="text-stone-500 underline underline-offset-4">Указание Типикона</a></p>
    </div>;
}
