"use client";

import {useMemo, useState} from "react";
import {orthodoxEaster} from "date-easter";

const Editor = () => {
    const [value, setValue] = useState("");

    const [clicked, setClicked] = useState(false);

    const date = useMemo(() => new Date(value), [value]);
    const easter = useMemo(() => orthodoxEaster(date),[date]);

    const easterDate = useMemo(() => new Date(easter.year, easter.month - 1, easter.day), [easter]);

    return (
        <div className="flex flex-col items-start">
            <div className="w-fit">
                <label className="pr-2">
                    Дата
                </label>
                <input
                    type="date"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                />
            </div>
            {value && (
                <div>
                    <p>
                        Информация по выбранной дате:
                    </p>
                    <p>
                        Пасха в {date.getFullYear()} году - {easterDate?.toLocaleDateString()}
                    </p>
                </div>
            )}
            <button onClick={() => setClicked(true)} className="font-bold">
                Получить чтения на выбранный день
            </button>
            {clicked && (
                <div>
                    Функционал пока не реализован
                </div>
            )}
        </div>
    );
};

export default Editor;
