import Link from "next/link";
import { MONTH_OF } from "@/utils/chantLabels";
import { datesOf, nameDay, type DatedMemory } from "@/lib/imeniny/dates";
import type { IndexedSaint, NameEntry } from "@/lib/imeniny/store";

// Ответ на вопрос «когда мои именины» — и всё, чем он оговорён.

// Память 24 декабря старого стиля приходится на 6 января СЛЕДУЮЩЕГО года:
// сдвиг календарей переносит конец декабря за черту года. Умолчать об этом —
// значит показать в перечне «за 2026 год» дату, которой в нём нет.
const dateLabel = (iso: string, year: number) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${MONTH_OF[m]}${y !== year ? ` ${y} года` : ""}`;
};

const SaintLine = ({ memory, lead, year }: {
    memory: DatedMemory<IndexedSaint>; lead?: boolean; year: number;
}) => (
    <li className={`font-serif ${lead ? "" : "text-sm"}`}>
        <span className={lead ? "font-bold" : ""}>{dateLabel(memory.date, year)}</span>
        {" — "}
        <Link href={`/saints/${memory.item.slug}`} className="text-red-900 hover:underline">
            {memory.item.name}
        </Link>
        {memory.movable && (
            <span className="text-xs text-slate-500"> · память подвижная, считается от Пасхи</span>
        )}
        {memory.item.confidence === "guess" && (
            <span className="text-xs text-amber-700"> · имя вынуто из соборной памяти</span>
        )}
    </li>
);

export const Result = ({ entry, born, year }: {
    entry: NameEntry;
    born: { month: number; day: number } | null;
    year: number;
}) => {
    const memories = entry.saints
        .flatMap(saint => datesOf(saint.dates, year, saint))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (!memories.length) {
        return (
            <p className="font-serif text-slate-700">
                Имя {entry.name} в святцах есть, а дней памяти у него не записано — значит и
                назначить по нему именины нечем. Это наш пробел, а не молчание святцев.
            </p>
        );
    }

    const chosen = born ? nameDay(born, memories) : null;

    return (
        <div className="flex flex-col gap-3">
            {chosen && (
                <div>
                    <p className="font-serif text-slate-800">
                        Ближайшая память после дня рождения — <strong>{dateLabel(chosen.date, year)}</strong>,{" "}
                        <Link href={`/saints/${chosen.item.slug}`} className="text-red-900 hover:underline">
                            {chosen.item.name}
                        </Link>.
                    </p>
                    {chosen.movable && (
                        <p className="font-serif text-sm text-slate-600">
                            Память подвижная: она считается от Пасхи, и в другой год придётся на
                            другое число. Здесь показан {year} год.
                        </p>
                    )}
                    {chosen.item.confidence === "guess" && (
                        <p className="font-serif text-sm text-amber-700">
                            Имя вынуто из соборной памяти, где имена перечислены вперемешку с
                            чинами и родством, — эту строку стоит посмотреть глазами.
                        </p>
                    )}
                </div>
            )}

            <div>
                <p className="font-serif font-bold text-sm">
                    Все дни памяти этого имени, счётом от {year} года
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                    {memories.map((memory, i) => (
                        <SaintLine key={`${memory.item.slug}-${memory.date}-${i}`} memory={memory}
                                   lead={chosen === memory} year={year} />
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Result;
