import { MONTHS_NOM } from "@/app/chronology/format";

// Вторая половина замысла: не разбор записи, а перевод дня из счёта в счёт.
//
// Ввод — тремя привычными календарями, у которых месяцы одни и те же. Коптский
// только показывается: месяцев у него тринадцать со своими именами, и второй
// список в форме ради редкого случая стоил бы больше, чем даёт. Понадобится
// ввод коптской даты — добавится отдельным полем, счёт для этого готов.

export const INPUT_CALENDARS = [
    ["julian", "юлианским"],
    ["gregorian", "григорианским"],
    ["revised", "новоюлианским"],
] as const;

export type InputCalendar = typeof INPUT_CALENDARS[number][0];

const DateForm = ({ values }: { values: Record<string, string | undefined> }) => (
    <form method="GET" action="/chronology" className="flex flex-row flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 font-serif text-sm">
            <span className="text-slate-600">Число</span>
            <input
                type="text" inputMode="numeric" name="dday" defaultValue={values.dday ?? ""}
                className="w-16 border border-slate-300 rounded px-2 py-1 font-serif"
            />
        </label>
        <label className="flex flex-col gap-1 font-serif text-sm">
            <span className="text-slate-600">Месяц</span>
            <select
                name="dmonth" defaultValue={values.dmonth ?? ""}
                className="border border-slate-300 rounded px-2 py-1 font-serif"
            >
                <option value="">—</option>
                {MONTHS_NOM.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
        </label>
        <label className="flex flex-col gap-1 font-serif text-sm">
            <span className="text-slate-600">Год от Рождества</span>
            <input
                type="text" inputMode="numeric" name="dyear" defaultValue={values.dyear ?? ""}
                placeholder="1204"
                className="w-24 border border-slate-300 rounded px-2 py-1 font-serif"
            />
        </label>
        <label className="flex flex-col gap-1 font-serif text-sm">
            <span className="text-slate-600">Каким счётом набрано</span>
            <select
                name="dcal" defaultValue={values.dcal ?? "julian"}
                className="border border-slate-300 rounded px-2 py-1 font-serif"
            >
                {INPUT_CALENDARS.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                ))}
            </select>
        </label>
        <button
            type="submit"
            className="font-serif border border-slate-400 rounded px-3 py-1 hover:bg-slate-50"
        >
            Перевести
        </button>
    </form>
);

export default DateForm;
