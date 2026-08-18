"use client";

import {useMemo, useState} from "react";
import {orthodoxEaster} from "date-easter";
import {csFont, myFont} from "@/utils/font";
import DayFullContent from "@/app/components/DayFullContent";
import DayMemories from "@/app/components/DayMemories";

const now = new Date();
const currMonthStr = now.getMonth() + 1 > 9 ? now.getMonth() + 1 :  `0${now.getMonth() + 1}`;

const Editor = () => {
    const [value, setValue] = useState(
        `${now.getFullYear()}-${currMonthStr}-${now.getDate() >= 10 ? now.getDate() : `0${now.getDate()}`}`
    );
    const [status, setStatus] = useState<"idle" | "not_found" | "error">("idle");

    const date = useMemo(() => new Date(value), [value]);
    const easter = useMemo(() => orthodoxEaster(date),[date]);

    const easterDate = useMemo(() => new Date(easter.year, easter.month - 1, easter.day), [easter]);

    const [data, setData] = useState<any>(null);

    const onCalculate = () => {
      setData(null);
      fetch("/api/calc", {
          method: "POST",
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              date: value,
          }),
      }).then((res) => {
          if (res.status === 404) {
              setStatus("not_found");
              return null;
          }
          if (!res.ok) {
              setStatus("error");
              return null;
          }
          setStatus("idle");
          return res.json();
      }).then((res) => {
          if (res) setData(res);
      });
    };

    return (
        <div className="flex flex-col items-start">
            <div className="flex flex-row">
                <div className="w-fit pr-2">
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
            </div>
            <button onClick={onCalculate} className="font-bold">
                Получить чтения на выбранный день
            </button>
            {status === "not_found" && (
                <div>
                    Ничего не найдено на эту дату
                </div>
            )}
            {status === "error" && (
                <div>
                    Не удалось получить чтения на эту дату
                </div>
            )}
            {data && (
                <div className={`${myFont.variable} ${csFont.variable}`}>
                    <p>
                        День - {data.day?.name}. Число (по старому стилю) - {new Date(data.date).toLocaleDateString()}
                    </p>
                    <DayMemories memories={data.memories} />
                    <DayFullContent item={data.day} paschal />
                </div>
            )}
        </div>
    );
};

export default Editor;
