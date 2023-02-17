"use client";

import {useMemo, useState} from "react";
import {orthodoxEaster} from "date-easter";
import DayTitle from "@/app/components/DayTitle";
import {TextType} from "@/utils/texts";
import DayPart from "@/app/components/DayPart";
import {myFont} from "@/utils/font";

const now = new Date();
const currMonthStr = now.getMonth() + 1 > 9 ? now.getMonth() + 1 :  `0${now.getMonth() + 1}`;

const Editor = () => {
    const [value, setValue] = useState(
        `${now.getFullYear()}-${currMonthStr}-${now.getDate()}`
    );
    const [notImplemented, setNotImplemented] = useState(false);

    const date = useMemo(() => new Date(value), [value]);
    const easter = useMemo(() => orthodoxEaster(date),[date]);

    const easterDate = useMemo(() => new Date(easter.year, easter.month - 1, easter.day), [easter]);

    const [data, setData] = useState<any>(null);

    const onCalculate = () => {
      fetch("/api/calc", {
          method: "POST",
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              date: value,
          }),
      }).then((res) => {
          if (res.status === 400) {
              setNotImplemented(true);
          } else {
              setNotImplemented(false);
              return res.json();
          }
      }).then((res) => {
          setData(res);
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
            {notImplemented && (
                <div>
                    Функционал пока не реализован (только Цветная триодь)
                </div>
            )}
            {data && (
                <div className={myFont.variable}>
                    <span>Ответ по триодному циклу получен. Cоединение с календарным днем пока в разработке.</span>
                    <p>
                        День - {data.day?.name}. Число (по старому стилю) - {new Date(data.date).toLocaleDateString()}
                    </p>
                    {/*Дублирование страницы дня, не мержатся данные по календарному дню*/}
                    <div className="flex flex-col pt-2 md:flex-row">
                        <div className="w-1/4">
                            <ul className="space-y-2">
                                <DayTitle value={data.day?.vigil} valueName={TextType.VIGIL} />
                                <DayTitle value={data.day?.kathisma1} valueName={TextType.KATHISMA_1} />
                                <DayTitle value={data.day?.kathisma2} valueName={TextType.KATHISMA_2} />
                                <DayTitle value={data.day?.kathisma3} valueName={TextType.KATHISMA_3} />
                                <DayTitle value={data.day?.ipakoi} valueName={TextType.IPAKOI} />
                                <DayTitle value={data.day?.polyeleos} valueName={TextType.POLYELEOS} />
                                <DayTitle value={data.day?.song3} valueName={TextType.SONG_3} />
                                <DayTitle value={data.day?.song6} valueName={TextType.SONG_6} />
                                <DayTitle value={data.day?.apolutikaTroparia} valueName={TextType.APOLUTIKA_TROPARIA} />
                                <DayTitle value={data.day?.before1h} valueName={TextType.BEFORE_1h} />
                                <DayTitle value={data.day?.panagia} valueName={TextType.PANAGIA} />
                            </ul>
                        </div>
                        <div className="flex flex-col flex-1 space-y-4">
                            <DayPart value={data.day?.vigil} valueName={TextType.VIGIL} paschal />
                            <DayPart value={data.day?.kathisma1} valueName={TextType.KATHISMA_1} paschal />
                            <DayPart value={data.day?.kathisma2} valueName={TextType.KATHISMA_2} paschal />
                            <DayPart value={data.day?.kathisma3} valueName={TextType.KATHISMA_3} paschal />
                            <DayPart value={data.day?.ipakoi} valueName={TextType.IPAKOI} paschal />
                            <DayPart value={data.day?.polyeleos} valueName={TextType.POLYELEOS} paschal />
                            <DayPart value={data.day?.song3} valueName={TextType.SONG_3} paschal />
                            <DayPart value={data.day?.song6} valueName={TextType.SONG_6} paschal />
                            <DayPart value={data.day?.before1h} valueName={TextType.BEFORE_1h} paschal />
                            <DayPart value={data.day?.apolutikaTroparia} valueName={TextType.APOLUTIKA_TROPARIA} paschal />
                            <DayPart value={data.day?.panagia} valueName={TextType.PANAGIA} paschal />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Editor;
