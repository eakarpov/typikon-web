import Link from "next/link";
import { MONTH_LABELS } from "@/utils/chantLabels";
import { trapezaMonth, type TrapezaCell } from "@/lib/trapeza/store";
import { todayCivil } from "@/lib/trapeza/core";

// Месяц трапезы сеткой.
//
// В КЛЕТКЕ НЕТ МЕСТА ОГОВОРКЕ, и это главная опасность этой страницы: сетка
// без оговорки — диетический календарик, то есть ровно то, чем раздел быть не
// должен. Поэтому оговорка стоит НАД сеткой тем же кеглем, что на странице
// дня; в клетке — только разрешение одним словом, а спор глав, разведённые
// сословия и наш собственный вывод помечены значком и уводят на день, где
// сказано всё.

const SHADE = [
    "bg-red-900 text-white",      // не ядим
    "bg-red-200",                 // сухоядение, варение
    "bg-amber-100",               // вино, елей, рыба
    "bg-slate-50",                // сыр, мясо, поста нет
];

const WEEK = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

/** Понедельник — первый столбец: церковная седмица начинается неделей, но
 *  сетку читают глазами мирянина, а он живёт по календарю. */
const offsetOf = (date: string): number => {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    return (day + 6) % 7;
};

const Cell = ({ cell, today }: { cell: TrapezaCell; today: string }) => {
    const shade = cell.shade === null ? "bg-white" : SHADE[cell.shade];
    return (
        <Link
            href={`/trapeza/${cell.date}`}
            className={`block border p-1 min-h-[3.5rem] ${shade} ${
                cell.date === today ? "border-red-900" : "border-slate-200"}`}
        >
            <span className="text-xs font-serif opacity-70">{cell.day}</span>
            <span className="block text-xs font-serif leading-tight">
                {cell.allowLabel ?? "—"}
            </span>
            <span className="text-[11px] font-serif opacity-70">
                {cell.disputed && "главы расходятся"}
                {!cell.disputed && cell.estates && "по сословиям"}
            </span>
        </Link>
    );
};

const Month = async ({ year, month }: { year: number; month: number }) => {
    const data = await trapezaMonth(year, month);
    const today = todayCivil();
    const lead = data.cells.length ? offsetOf(data.cells[0].date) : 0;
    const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
    const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="font-bold font-serif">
                    Трапеза: {MONTH_LABELS[month]} {year}
                </h1>
                <p className="font-serif text-slate-700 mt-2">
                    Типикон — устав <strong>монастырский</strong>, и сетка эта показывает, что
                    книга назначает братии обители, а не что положено вам. В клетке — одно слово;
                    правило, глава и цитата — на странице дня.
                </p>
                <p className="font-serif text-sm text-slate-600 mt-1">
                    Где книга разводит монаха и мирянина, в клетке стоит строгая мера, а
                    различие помечено словом: сжать два разрешения в одну клетку нельзя.
                </p>
            </div>

            <div className="flex gap-4 items-baseline font-serif text-sm">
                <Link href={`/trapeza/${prev}`} className="text-red-900">← прошлый месяц</Link>
                <Link href={`/trapeza/${today}`} className="text-red-900">сегодня</Link>
                <Link href={`/trapeza/${next}`} className="text-red-900">следующий →</Link>
            </div>

            <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-1 min-w-[36rem]">
                    {WEEK.map(w => (
                        <div key={w} className="text-xs text-slate-500 font-serif text-center">{w}</div>
                    ))}
                    {Array.from({ length: lead }, (_, i) => <div key={`pad${i}`} />)}
                    {data.cells.map(cell => <Cell key={cell.date} cell={cell} today={today} />)}
                </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-500 font-serif">
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-red-900" /> не ядим
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-red-200" /> сухоядение, варение
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-amber-100" /> вино, елей, рыба
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 bg-slate-50 border border-slate-200" />
                    сыр, мясо, поста нет
                </span>
            </div>

            {data.failed.length > 0 && (
                // Пустая клетка — это «не спросили», а не «поста нет»; молчать
                // об этом нельзя, иначе сбой читается разрешением.
                <p className="text-sm text-amber-700 font-serif">
                    На {data.failed.length} дней движок устава не ответил, и клетки у них пусты.
                    Это сбой, а не разрешение.
                </p>
            )}
        </div>
    );
};

export default Month;
