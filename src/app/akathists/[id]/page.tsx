import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAkathist } from "@/lib/akathists";
import { prayersOfAkathist } from "@/lib/prayers";
import { myFont } from "@/utils/font";
import {
    AKATHIST_STATUS_LABELS, BOOK_LABELS, SUBJECT_KIND_LABELS, UNIT_LABELS,
    labelOf, stanzaLabel,
} from "@/utils/chantLabels";

export const dynamic = "force-dynamic";

export async function generateMetadata(
    { params }: { params: { id: string } },
): Promise<Metadata> {
    const a = getAkathist(params.id);
    if (!a) return { title: "Акафист не найден — Уставные чтения" };
    return {
        title: `${a.title} — Уставные чтения`,
        description: `Все кондаки и икосы подряд, ${a.stanzas} строф.`,
    };
}

const AkathistPage = ({ params }: { params: { id: string } }) => {
    const a = getAkathist(params.id);
    if (!a) notFound();
    const prayers = prayersOfAkathist(params.id);

    return (
        <div className={`${myFont.variable} pt-2`}>
            <Link href="/akathists" className="font-serif text-sm text-red-900">← к акафистам</Link>
            <h1 className="font-bold font-serif mt-2">{a.title}</h1>
            <p className="text-sm text-slate-500 font-serif">
                {[
                    labelOf(SUBJECT_KIND_LABELS, a.subjectKind),
                    labelOf(AKATHIST_STATUS_LABELS, a.status),
                    `строф ${a.stanzas}`,
                ].filter(Boolean).join(" · ")}
            </p>
            {a.memory && (
                // Память есть только у Великого: он один напечатан внутри
                // богослужебной книги, а не в акафистнике.
                <p className="font-serif text-sm">
                    <strong>Напечатан в службе: </strong>{a.memory}
                </p>
            )}
            {a.refrainIkos && (
                <p className="font-serif text-sm">
                    <strong>Рефрен икосов: </strong>{a.refrainIkos}
                </p>
            )}

            {a.lines.map(line => (
                <section key={line.index} className="mt-4">
                    <h2 className="font-serif font-bold text-sm">
                        {stanzaLabel(line.unit, line.stanza, line.kind)}
                        {line.kind === "prooimion" && (
                            // Проимий стоит вне акростиха, и по форме он кондак.
                            // Без пометы читатель принял бы его за кондак 1
                            // основного ряда — а тот в акростихе есть свой.
                            <span className="font-normal text-slate-500">
                                {" "}· вступительный кондак, вне акростиха
                            </span>
                        )}
                        {line.letter && (
                            <span className="font-normal text-slate-500">
                                {" "}· {line.letter}
                            </span>
                        )}
                        {!line.letter && line.kind === "stanza" && (
                            <span className="font-normal text-slate-500">
                                {" "}· {labelOf(UNIT_LABELS, line.unit)}
                            </span>
                        )}
                    </h2>
                    <p className="font-serif text-slate-800">{line.text}</p>
                </section>
            ))}

            {prayers.length > 0 && (
                // Молитва при акафисте — не строфа: у неё нет ни номера, ни
                // места в акростихе, и живёт она своей сущностью (prayers).
                // Но печатается она здесь же, и читателю нужна здесь же.
                <div className="mt-6 pt-3 border-t border-slate-300">
                    <h2 className="font-serif font-bold">Молитвы</h2>
                    {prayers.map(p => (
                        <p key={p.id} className="mt-2">
                            <Link href={`/prayers/${p.id}`} className="font-serif text-red-900">
                                {p.title || "Молитва"}
                            </Link>
                            <span className="font-serif text-slate-700"> — {p.incipit}…</span>
                        </p>
                    ))}
                </div>
            )}

            {a.sourceBook && (
                // Адрес есть не у всякого источника, и его отсутствие — не
                // повод молчать об источнике вовсе: у Великого акафиста это
                // печатная Триодь, у которой адреса нет и быть не может.
                <p className="font-serif text-xs text-slate-500 mt-6">
                    Источник: {labelOf(BOOK_LABELS, a.sourceBook)}
                    {a.sourceUrl && (
                        <>
                            {" · "}
                            <a href={a.sourceUrl} className="text-red-900 underline"
                               target="_blank" rel="noopener noreferrer">
                                {a.sourceUrl}
                            </a>
                        </>
                    )}
                </p>
            )}
        </div>
    );
};

export default AkathistPage;
