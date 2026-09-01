import { MONTHS_NOM } from "@/app/chronology/format";
import { WEEKDAYS } from "@/utils/chronology";

// Форма обычная, с методом GET и без своего кода на клиенте: запрос остаётся
// в адресе, разбор можно послать ссылкой и сослаться на него в сноске — а
// цитируемость и есть то, чем такой инструмент входит в науку.

export interface FormValues {
    [key: string]: string | undefined;
}

const Field = ({ name, label, value, placeholder, width = "w-24" }: {
    name: string; label: string; value?: string; placeholder?: string; width?: string;
}) => (
    <label className="flex flex-col gap-1 font-serif text-sm">
        <span className="text-slate-600">{label}</span>
        <input
            type="text" inputMode="numeric" name={name} defaultValue={value ?? ""}
            placeholder={placeholder}
            className={`${width} border border-slate-300 rounded px-2 py-1 font-serif`}
        />
    </label>
);

const Form = ({ values }: { values: FormValues }) => (
    <form method="GET" action="/chronology" className="flex flex-col gap-4">
        {/* Форма отправляет только свои поля, и без этого разбор возвращал бы
            на вкладку перевода дат. */}
        <input type="hidden" name="tab" value="solver" />
        <fieldset className="flex flex-row flex-wrap gap-3 items-end">
            <legend className="font-serif font-bold text-sm mb-1">Что стоит в записи</legend>
            <Field name="leto" label="Лето от Адама" value={values.leto} placeholder="6712" />
            <Field name="indikt" label="Индикт" value={values.indikt} width="w-16" />
            <label className="flex flex-col gap-1 font-serif text-sm">
                <span className="text-slate-600">Месяц</span>
                <select
                    name="month" defaultValue={values.month ?? ""}
                    className="border border-slate-300 rounded px-2 py-1 font-serif"
                >
                    <option value="">—</option>
                    {MONTHS_NOM.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                    ))}
                </select>
            </label>
            <Field name="day" label="Число" value={values.day} width="w-16" />
            <label className="flex flex-col gap-1 font-serif text-sm">
                <span className="text-slate-600">День недели</span>
                <select
                    name="weekday" defaultValue={values.weekday ?? ""}
                    className="border border-slate-300 rounded px-2 py-1 font-serif"
                >
                    <option value="">—</option>
                    {WEEKDAYS.map(d => (
                        <option key={d} value={d}>
                            {d === "воскресенье" ? "неделя (воскресенье)" : d}
                        </option>
                    ))}
                </select>
            </label>
        </fieldset>

        <fieldset className="flex flex-row flex-wrap gap-3 items-end">
            <legend className="font-serif font-bold text-sm mb-1">
                Если писец назвал и круги
            </legend>
            <Field name="krugSolntsu" label="Круг Солнцу" value={values.krugSolntsu} width="w-20" />
            <Field name="krugLune" label="Круг Луне" value={values.krugLune} width="w-20" />
            <Field name="vrutseleto" label="Вруцелето" value={values.vrutseleto} width="w-20" />
            <Field name="osnovanie" label="Основание" value={values.osnovanie} width="w-20" />
            <Field name="epakta" label="Эпакта" value={values.epakta} width="w-20" />
            <Field name="klyuchGranits" label="Ключ границ" value={values.klyuchGranits} width="w-20" />
        </fieldset>

        <fieldset className="flex flex-row flex-wrap gap-3 items-end">
            <legend className="font-serif font-bold text-sm mb-1">
                Где искать, годы от Рождества
            </legend>
            <Field name="from" label="от" value={values.from} placeholder="988" width="w-20" />
            <Field name="to" label="до" value={values.to} placeholder="1700" width="w-20" />
            <button
                type="submit"
                className="font-serif border border-slate-400 rounded px-3 py-1 hover:bg-slate-50"
            >
                Разобрать
            </button>
            <a href="/chronology?tab=solver" className="font-serif text-sm text-amber-800 hover:underline">
                очистить
            </a>
        </fieldset>
    </form>
);

export default Form;
