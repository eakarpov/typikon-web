"use client";

import {TextType, valueTitle} from "@/utils/texts";

export interface IDayPart {
    value: any;
    valueName: TextType;
    setter: any;
    triodic: boolean;
    setTextField: (itemName: TextType, index: number, field: "textId"|"cite"|"triodic", value: string|boolean) => void;
}

export const DayPart = ({
                            value,
                            valueName,
                            setter,
                            triodic,
                            setTextField,
}: IDayPart) => {
    return (
        <>
            <label>
                <span className="font-bold">{valueTitle(valueName)}</span>
                <span
                    className="cursor-pointer text-slate-300"
                    onClick={() => {
                        setter({ items: [ ...(value?.items || []), { cite: "", textId: "", triodic } ]});
                    }}
                >
                    Добавить
                </span>
            </label>
            {value && (
                <div>
                    <label className="text-xs">
                        Данные по песни
                    </label>
                    {value.items?.map((item: any, index: number) => (
                        <div key={item.textId} className="flex flex-col">
                            <span
                                className="cursor-pointer text-slate-300"
                                onClick={() => setter(
                                    value.items?.length > 1
                                        ? { items: [ value.items.filter((e: any, i: number) => i !== index)]}
                                        : null
                                )}
                            >
                                Удалить
                            </span>
                            <label>
                                Цитата из Типикона
                            </label>
                            <input
                                className="border-2"
                                value={item.cite}
                                onChange={e => setTextField(valueName, index, "cite", e.target.value)}
                            />
                            <div onClick={() => setTextField(valueName, index, "triodic", !item.triodic)}>
                                {item.triodic ? "Триодный цикл" : "Календарный цикл"}
                            </div>
                            {item.triodic === triodic && (
                                <>
                                    <label>
                                        Идентификатор текста
                                    </label>
                                    <input
                                        className="border-2"
                                        value={item.textId}
                                        onChange={e => setTextField(valueName, index, "textId", e.target.value)}
                                    />
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </>
    )
};

export default DayPart;
