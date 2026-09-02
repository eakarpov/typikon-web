import type { Metadata } from "next";
import Link from "next/link";
import { tuneLibrary } from "@/lib/tunes/registry";
import { NOTATION_LABELS } from "@/lib/tunes/types";
import { myFont } from "@/utils/font";

// Список напевов.
//
// Раздел служебный: он нужен не читателю службы, а тому, кто напевы вводит.
// Ноты снимаются с книги руками, и сверить снятое можно только увидев его
// разложенным на том самом тексте, под которым напев напечатан. Корпус для
// этого не годится: колена он размечает не везде, и того самого песнопения в
// нём может не оказаться размеченным вовсе.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Напевы — Уставные чтения",
    description: "Напевы обихода: традиции, гласы, подобны — каждый на своём образцовом тексте.",
};

const Tunes = () => {
    const { traditions, tunes, problems } = tuneLibrary();

    return (
        <div className={`${myFont.variable} pt-2`}>
            <h1 className="font-bold font-serif">Напевы</h1>
            <p className="text-sm text-slate-500 font-serif mt-1">
                Чем поётся песнопение. Напев выбирается гласом и родом песнопения
                либо подобном; запись у него бывает крюковая и линейная.
            </p>

            {problems.length > 0 && (
                // Расхождения в данных показываем здесь же: этот раздел для того,
                // кто напевы вводит, и молчать о них перед ним незачем.
                <ul className="text-xs text-amber-700 font-serif mt-3 list-disc pl-4">
                    {problems.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
            )}

            {traditions.map(tradition => {
                const own = tunes.filter(t => t.traditionId === tradition.id);
                return (
                    <section key={tradition.id} className="mt-5">
                        <h2 className="font-serif text-slate-800">{tradition.title}</h2>
                        {tradition.note && (
                            <p className="text-xs text-slate-500 font-serif">{tradition.note}</p>
                        )}
                        {own.length === 0
                            ? <p className="text-sm text-slate-400 font-serif mt-1">Напевов пока нет.</p>
                            : (
                                <ul className="mt-2 flex flex-col gap-1">
                                    {own.map(tune => (
                                        <li key={tune.id} className="text-sm font-serif">
                                            <Link href={`/tunes/${tune.id}`} className="text-red-900">
                                                {tune.title}
                                            </Link>
                                            <span className="text-xs text-slate-400 ml-2">
                                                {[...new Set(tune.scores.map(s => NOTATION_LABELS[s.notation]))].join(", ")}
                                                {tune.sample ? "" : " · образца нет"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                    </section>
                );
            })}
        </div>
    );
};

export default Tunes;
