import * as ch from "@/utils/chronology";
import { Candidate, Field, FIELD_LABELS, Fix, Result as SolveResult, verdict } from "@/lib/dating";
import { ERA_LABELS, jdnToJulian } from "@/utils/chronology";
import { showDay, showSpan } from "@/app/chronology/format";

// Разбор, а не один ответ. Перебор показывается вместе с отсевом: видно не
// только, какой год подошёл, но и на чём отсеялись остальные. Ответ без вывода
// медиевисту не годится — его нельзя ни проверить, ни оспорить.
//
// Слова здесь нарочно обыденные. «Выжил» и «отпал» — метафора решета, понятная
// тому, кто писал перебор, и никому больше: читатель видит подпись и не знает,
// что она про него утверждает.

/** Сколько кандидатов ещё рисуем поимённо; дальше — только сводкой. */
const MATRIX_LIMIT = 16;

const Tick = ({ ok }: { ok: boolean | undefined }) => {
    if (ok === undefined) return <span className="text-slate-300">·</span>;
    return ok
        ? <span className="text-emerald-700">✓</span>
        : <span className="text-red-600">✗</span>;
};

const Matrix = ({ result }: { result: SolveResult }) => (
    <div className="overflow-x-auto">
        <table className="font-serif text-sm border-collapse">
            <thead>
                <tr className="text-slate-600">
                    <th className="text-left font-normal pr-4 pb-1">Чтение</th>
                    <th className="text-left font-normal pr-4 pb-1">День</th>
                    {result.applied.map(f => (
                        <th key={f} className="font-normal px-2 pb-1">{FIELD_LABELS[f]}</th>
                    ))}
                    <th className="pl-4 pb-1 text-left font-normal">Итог</th>
                </tr>
            </thead>
            <tbody>
                {result.candidates.map((c, i) => (
                    <tr key={i} className={c.fits ? "" : "text-slate-400"}>
                        <td className="pr-4 py-0.5">
                            {c.label}
                            {c.note && (
                                <span className="block text-xs text-slate-500">{c.note}</span>
                            )}
                        </td>
                        <td className="pr-4 py-0.5 whitespace-nowrap">
                            {c.jdn === null ? "—" : showDay(c.jdn).julian}
                        </td>
                        {result.applied.map(f => (
                            <td key={f} className="px-2 py-0.5 text-center">
                                <Tick ok={c.checks[f]} />
                            </td>
                        ))}
                        <td className="pl-4 py-0.5 whitespace-nowrap">
                            {c.fits
                                ? <span className="text-emerald-800 font-bold">подходит</span>
                                : c.failedOn === "date"
                                    ? "такого числа в году нет"
                                    : `не сошёлся ${FIELD_LABELS[c.failedOn as Field]}`}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const Summary = ({ result }: { result: SolveResult }) => (
    <div className="font-serif text-sm flex flex-col gap-1">
        <p className="text-slate-600">
            Рассмотрено лет: {result.considered}. Отсев по условиям — сколько лет
            отпало на каждом (год засчитан первому условию, которое его отвергло):
        </p>
        <ul className="list-disc pl-5">
            {result.killedByDate > 0 && (
                <li>такого числа в году нет — {result.killedByDate}</li>
            )}
            {result.applied.map(f => (
                <li key={f}>{FIELD_LABELS[f]} — {result.killed[f] ?? 0}</li>
            ))}
        </ul>
    </div>
);

const YearCard = ({ candidate }: { candidate: Candidate }) => {
    const m = candidate.marks;
    const pascha = showDay(m.paschaJdn);
    const day = candidate.jdn === null ? null : showDay(candidate.jdn);
    const rows: [string, string][] = [
        ["Индикт", String(m.indikt)],
        ["Круг Солнцу", String(m.krugSolntsu)],
        ["Круг Луне", String(m.krugLune)],
        ["Вруцелето", `${m.vrutseleto} (${m.vrutseletoLetter})`],
        ["Основание", String(m.osnovanie)],
        ["Эпакта", String(m.epakta)],
        ["Ключ границ", m.klyuchGranits],
    ];

    return (
        <div className="border border-slate-300 rounded p-3 flex flex-col gap-2">
            <p className="font-serif font-bold">{candidate.label}</p>
            {candidate.note && (
                <p className="font-serif text-sm text-slate-500">{candidate.note}</p>
            )}
            {/* Промежуток у сведённых чтений разный, хотя ответ один: показать
                только первый значило бы утаить половину сведения. */}
            <ul className="font-serif text-sm text-slate-600">
                {candidate.readings.length
                    ? candidate.readings.map(({ style, span }) => (
                        <li key={style}>
                            {ERA_LABELS[style]} счёт: {showSpan(span)} юлианского счёта
                        </li>
                    ))
                    : <li>Год круга: {showSpan(candidate.span)} юлианского счёта</li>}
            </ul>
            <p className="font-serif text-sm text-slate-600">
                Числа года — лета {m.leto} книжного счёта{m.vysokosniy ? ", високосное" : ""}.
            </p>
            {day && candidate.jdn !== null && (
                <p className="font-serif">
                    День записи — {day.weekday}, {day.julian} юлианского счёта
                    <span className="text-slate-600"> ({day.civil} гражданского)</span>.{" "}
                    {/* Ссылка, а не второй разбор в карточке: видов даты шесть, и
                        при нескольких подошедших годах они забили бы страницу. */}
                    <a
                        className="text-amber-800 hover:underline text-sm"
                        href={`/chronology?${new URLSearchParams({
                            dday: String(jdnToJulian(candidate.jdn).day),
                            dmonth: String(jdnToJulian(candidate.jdn).month),
                            dyear: String(jdnToJulian(candidate.jdn).year),
                            dcal: "julian",
                        })}`}
                    >
                        во всех календарях
                    </a>
                </p>
            )}
            <p className="font-serif text-sm">
                Пасха: {pascha.julian} юлианского счёта, ключ {m.klyuchGranits}.
            </p>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 font-serif text-sm">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex flex-row justify-between border-b border-slate-100">
                        <dt className="text-slate-600">{label}</dt>
                        <dd className="font-bold">{value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
};

const Fixes = ({ fixes }: { fixes: Fix[] }) => {
    if (!fixes.length) {
        return (
            <p className="font-serif text-slate-600">
                Ни одна поправка в одном условии записи не спасает: либо испорчено
                больше одного числа, либо год лежит вне окна поиска.
            </p>
        );
    }
    return (
        <div className="flex flex-col gap-2">
            <p className="font-serif text-slate-600">
                Чем запись чинится. Ниже — какое чтение потребовалось бы на месте
                одного из условий, чтобы всё сошлось. Порядок — по величине правки,
                а не по вероятности: описка на единицу правдоподобнее описки на
                четыре, но решает это палеография, а не арифметика.
            </p>
            <ul className="flex flex-col gap-1">
                {fixes.slice(0, 12).map((fix, i) => (
                    <li key={i} className="font-serif">
                        читать <b>{fix.label}</b> как <b>{String(fix.needed)}</b>
                        {fix.stated !== undefined && <> вместо {String(fix.stated)}</>}
                        {fix.size !== null && (
                            <span className="text-slate-500"> (правка на {fix.size})</span>
                        )}
                        {" → "}
                        {fix.candidate.jdn !== null
                            ? showDay(fix.candidate.jdn).julian
                            : fix.candidate.label}
                        {fix.note && <span className="text-slate-500">, {fix.note}</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const Result = ({ result, fixes }: { result: SolveResult; fixes: Fix[] }) => {
    const v = verdict(result);
    const tone = v.kind === "none" ? "text-red-700"
        : v.kind === "many" ? "text-amber-800" : "text-emerald-800";

    return (
        <section className="flex flex-col gap-4">
            <p className={`font-serif font-bold ${tone}`}>{v.text}</p>

            {v.kind === "same-day" && (
                <p className="font-serif text-slate-600">
                    Мартовский стиль с сентябрьским расходятся только на
                    сентябре–декабре, и запись, попавшая в март–август, их не
                    различает — но датируется при этом точно. Считать это
                    неоднозначностью значило бы отдать твёрдую дату за спор о стиле,
                    которого запись не решает и решать не обязана.
                </p>
            )}

            <div className="flex flex-col gap-2">
                <h2 className="font-serif font-bold">Разбор по условиям</h2>
                {/* Пояснение своё у каждого вида: в таблице объяснять надо строки
                    и столбцы, а в сводке их нет, и та же подпись сбивала бы. */}
                {result.considered <= MATRIX_LIMIT ? (
                    <>
                        <p className="font-serif text-sm text-slate-600">
                            Строка — одно прочтение записи, столбец — одно её условие.
                            <b> Подходит</b> значит, что это прочтение выдержало все
                            условия сразу; остальные отсеялись, и видно, на каком именно.
                        </p>
                        <Matrix result={result} />
                    </>
                ) : <Summary result={result} />}
            </div>

            {result.survivors.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="font-serif font-bold">
                        {result.survivors.length === 1 ? "Год" : "Годы, которые подошли"}
                    </h2>
                    {result.survivors.slice(0, 12).map((c, i) => <YearCard key={i} candidate={c} />)}
                    {result.survivors.length > 12 && (
                        <p className="font-serif text-slate-600">
                            …и ещё {result.survivors.length - 12}. Назовите больше чисел
                            записи или сузьте окно поиска.
                        </p>
                    )}
                </div>
            )}

            {result.survivors.length === 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="font-serif font-bold">Что мешало</h2>
                    <Fixes fixes={fixes} />
                </div>
            )}
        </section>
    );
};

export default Result;
