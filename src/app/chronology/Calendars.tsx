import * as ch from "@/utils/chronology";
import { calendarViews, eraViews, showDay } from "@/app/chronology/format";

// Один день во всех видах. Совпавшие счета стоят одной строкой: две одинаковые
// строки читались бы как два разных ответа, а это один в двух именах.

const Calendars = ({ jdn, title }: { jdn: number; title?: string }) => {
    const day = showDay(jdn);
    const views = calendarViews(jdn);
    const eras = eraViews(jdn);

    return (
        <div className="flex flex-col gap-2">
            {title && <h2 className="font-serif font-bold">{title}</h2>}
            <p className="font-serif">
                День недели — <b>{day.weekday}</b>. Он один во всех календарях: смена
                счёта переименовывает числа, а не переставляет дни.
            </p>

            <div className="overflow-x-auto">
                <table className="font-serif text-sm border-collapse">
                    <tbody>
                        {views.map((view) => (
                            <tr
                                key={view.names.join()}
                                className={`align-baseline ${view.planned ? "text-slate-400" : ""}`}
                            >
                                <td className={`pr-4 py-0.5 whitespace-nowrap ${
                                    view.planned ? "" : "text-slate-600"}`}>
                                    {view.names.join(" и ")}
                                </td>
                                <td className={`py-0.5 whitespace-nowrap ${
                                    view.planned ? "italic" : "font-bold"}`}>
                                    {view.value}
                                </td>
                                <td className="pl-3 py-0.5 text-slate-500">{view.note}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h3 className="font-serif font-bold text-sm mt-1">Лето от Сотворения мира</h3>
            <div className="overflow-x-auto">
                <table className="font-serif text-sm border-collapse">
                    <tbody>
                        {eras.map((era) => (
                            <tr
                                key={era.name}
                                className={`align-baseline ${era.planned ? "text-slate-400" : ""}`}
                            >
                                <td className="pr-4 py-0.5 whitespace-nowrap">{era.name}</td>
                                <td className={`py-0.5 whitespace-nowrap ${
                                    era.planned ? "italic" : "font-bold"}`}>
                                    {era.value}
                                </td>
                                <td className="pl-3 py-0.5 text-slate-500">{era.note}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/** Семь чисел года, которому день принадлежит. */
export const YearNumbers = ({ jdn }: { jdn: number }) => {
    const m = ch.marksOfJdn(jdn);
    const pascha = showDay(m.paschaJdn);
    return (
        <p className="font-serif text-sm">
            Год круга — лето <b>{m.leto}</b> книжного счёта
            {m.vysokosniy ? ", високосное" : ""}: индикт <b>{m.indikt}</b>,
            круг Солнцу <b>{m.krugSolntsu}</b>, круг Луне <b>{m.krugLune}</b>,
            вруцелето <b>{m.vrutseleto}</b> ({m.vrutseletoLetter}),
            основание <b>{m.osnovanie}</b>, эпакта <b>{m.epakta}</b>,
            ключ границ <b>{m.klyuchGranits}</b>. Пасха — {pascha.julian} юлианского
            счёта. <span className="text-slate-600">
                Январь и февраль держат числа предыдущего года круга: он поворачивается
                1 марта, а не 1 января.
            </span>
        </p>
    );
};

export default Calendars;
