"use client";

import {TextType, valueTitle} from "@/utils/texts";

export interface IDayPart {
    value: any;
    valueName: TextType;
    setter: any;
    triodic: boolean;
    setTextCite: any;
    setTextId: any;
}

export const DayPart = ({
                            value,
                            valueName,
                            setter,
                            triodic,
                            setTextCite,
                            setTextId,
}: IDayPart) => {
    return (
        <>
            <label>
                <span className="font-bold">{valueTitle(valueName)}</span> {!value ? (
                <span
                    className="cursor-pointer text-slate-300"
                    onClick={() => {
                        setter({ items: [ { cite: "", textId: "", triodic } ]});
                    }}
                >Добавить</span>
            ) : (
                <span
                    className="cursor-pointer text-slate-300"
                    onClick={() => setter(null)}
                >
                    Удалить
                </span>
            )}
            </label>
            {value && (
                <div>
                    <label className="text-xs">
                        Данные по песни
                    </label>
                    {value.items?.map((item: any, index: number) => (
                        <div key={item.textId} className="flex flex-col">
                            <label>
                                Цитата из Типикона
                            </label>
                            <input
                                className="border-2"
                                value={item.cite}
                                onChange={e => setTextCite(valueName, index, e.target.value)}
                            />
                            <label>
                                Идентификатор текста
                            </label>
                            <input
                                className="border-2"
                                value={item.textId}
                                onChange={e => setTextId(valueName, index, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </>
    )
};

export default DayPart;
