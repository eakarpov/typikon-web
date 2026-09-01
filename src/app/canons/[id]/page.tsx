import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCanon, type CanonLine } from "@/lib/canons";
import { myFont } from "@/utils/font";
import {
    BOOK_LABELS, CANON_ROLE_LABELS, MARKER_LABELS, SERVICE_LABELS,
    labelOf, memoryAddress,
} from "@/utils/chantLabels";

export const dynamic = "force-dynamic";

export async function generateMetadata(
    { params }: { params: { id: string } },
): Promise<Metadata> {
    const canon = getCanon(params.id);
    if (!canon) return { title: "Канон не найден — Уставные чтения" };
    return {
        title: `Канон: ${canon.memory} — Уставные чтения`,
        description: [
            labelOf(BOOK_LABELS, canon.book),
            memoryAddress(canon),
            canon.creator || "",
        ].filter(Boolean).join(", "),
    };
}

// Песни печатаются подряд, как в книге: ирмос, затем тропари. Нумерация
// НЕ сплошная — второй песни в каноне нет ни у кого, кроме Великого канона,
// а трипеснцы Триоди несут три и меньше. Поэтому показываем номер, который
// стоит у песни в книге, а не порядковый: «Песнь 3» после «Песни 1» — это не
// пропуск разбора, это как напечатано.
const Line = ({ line }: { line: CanonLine }) => (
    <p className="font-serif text-slate-800 mb-2">
        {line.marker && (
            <span className="text-xs px-1.5 py-0.5 mr-2 rounded bg-slate-100 text-slate-600">
                {labelOf(MARKER_LABELS, line.marker)}
            </span>
        )}
        {line.text}
        {line.repeat > 1 && (
            <span className="text-xs text-slate-500"> [{line.repeat} раза]</span>
        )}
        {line.borrowed && (
            // Текста в этой книге нет: она печатает зачин, а само песнопение
            // лежит в Ирмологии или в соседнем каноне. Показываем найденное,
            // но говорим, что оно не отсюда.
            <span className="text-xs text-slate-400 italic"> · текст по ссылке</span>
        )}
    </p>
);

const CanonPage = ({ params }: { params: { id: string } }) => {
    const canon = getCanon(params.id);
    if (!canon) notFound();

    const head = [
        labelOf(BOOK_LABELS, canon.book),
        memoryAddress(canon) || null,
        labelOf(SERVICE_LABELS, canon.service),
        canon.tone ? `глас ${canon.tone}` : null,
        canon.role ? labelOf(CANON_ROLE_LABELS, canon.role) : null,
    ].filter(Boolean);

    return (
        <div className={`${myFont.variable} pt-2`}>
            <Link href="/canons" className="font-serif text-sm text-red-900">← к канонам</Link>
            <h1 className="font-bold font-serif mt-2">{canon.memory || "Канон"}</h1>
            <p className="text-sm text-slate-500 font-serif">{head.join(" · ")}</p>
            {/* Лицо и надписание — разные вещи, и стоят они порознь. Сверху то,
                с чем надписание отождествлено («Иосиф Песнописец, IX в.»);
                ниже — как эту же строку напечатала книга («Творе́ние
                Ио́сифово. Гла́с 2.»), потому что напечатанное и есть
                свидетельство, а отождествление — вывод из него, и он может
                быть неверен. Где отождествления нет, остаётся одно
                надписание: гадать за книгу мы не станем. */}
            {canon.author && (
                <p className="font-serif text-sm">
                    <strong>Творение: </strong>{canon.author}
                    {canon.authorCentury ? `, ${canon.authorCentury} в.` : ""}
                </p>
            )}
            {canon.creator && (
                <p className="font-serif text-sm text-slate-600">
                    <strong>{canon.author ? "Надписание книги: " : "Творение: "}</strong>
                    {canon.creator}
                </p>
            )}
            {canon.acrostic && (
                <p className="font-serif text-sm"><strong>Краегранесие: </strong>{canon.acrostic}</p>
            )}

            {canon.odesList.length === 0 && (
                <p className="font-serif text-slate-600 mt-4">
                    У этого канона книга объявила заголовок, но песней при нём не напечатала.
                </p>
            )}

            {canon.odesList.map(ode => (
                <section key={ode.ode} className="mt-5">
                    <h2 className="font-serif font-bold">Песнь {ode.ode}</h2>
                    {ode.irmos.map((line, i) => (
                        <div key={`i${i}`}>
                            <div className="text-xs text-slate-500 font-serif mt-2">Ирмос</div>
                            <Line line={line} />
                        </div>
                    ))}
                    {ode.troparia.length > 0 && (
                        <div className="text-xs text-slate-500 font-serif mt-2">Тропари</div>
                    )}
                    {ode.troparia.map((line, i) => <Line key={`t${i}`} line={line} />)}
                </section>
            ))}
        </div>
    );
};

export default CanonPage;
