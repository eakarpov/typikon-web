'use client';
import {SIGN} from "@/types/dto/days";
import {Dispatch, SetStateAction, useCallback, useState} from "react";

export interface ISaintPartItem {
    slugId: string;
    eventId: string;
    signDefault: SIGN;
}

interface ISaintAddPart {
    item: ISaintPartItem;
    index: number;
    saveSign: (field: keyof ISaintPartItem, value: string, index: number) => void;
}

const SaintAddPart = ({ item, saveSign, index } : ISaintAddPart) => {
    const [slug, setSlug] = useState<string>(item.slugId || "");
    const [val, setVal] = useState<string>(item.eventId || "");
    const [sign, setSign] = useState<SIGN|null>(item.signDefault || null);
    const [title, setTitle] = useState("");

    const onSaveSlug = useCallback(() => {
        fetch(`http://dneslov.org/${slug}/${val}.json`).then((res) => res.json()).then((res) => {
            setTitle(res.event.text);
        });
        saveSign("slugId", val, index);
    }, [slug, val]);

    const onSaveText = useCallback(() => {
        fetch(`http://dneslov.org/${slug}/${val}.json`).then((res) => res.json()).then((res) => {
            setTitle(res.event.text);
        });
        saveSign("eventId", val, index);
    }, [slug, val]);

    const onSaveSign =  useCallback(() => {
        saveSign("signDefault", val, index);
    }, [val]);

    return (
        <div className="flex flex-col mt-4">
            <div className="flex flex-row items-end gap-2">
                <div className="flex flex-col">
                    <label>
                        Идентификатор святого (slug)
                    </label>
                    <input
                        style={{ width: '250px'}}
                        className="border-2"
                        onBlur={onSaveSlug}
                        value={slug}
                        onChange={e => setSlug(e.target.value)}
                    />
                </div>
                <div className="flex flex-col">
                    <label>
                        Идентификатор события святого (eventId Dneslov)
                    </label>
                    <input
                        style={{ width: '250px'}}
                        className="border-2"
                        onBlur={onSaveText}
                        value={val}
                        onChange={e => setVal(e.target.value)}
                    />
                </div>
                <div className="flex flex-col">
                    <label>
                        Знак службы по Типикону
                    </label>
                    <select
                        style={{ width: '250px'}}
                        className="border-2"
                        onBlur={onSaveSign}
                        value={sign || ""}
                        onChange={e => setSign(e.target.value as SIGN)}
                    >
                        <option value={SIGN.HALLELUJAH}>Аллилуйная</option>
                        <option value={SIGN.NO_SIGN}>Без знака</option>
                        <option value={SIGN.SIX_STICHERA}>Шестеричная</option>
                        <option value={SIGN.DOXOLOGIC}>Славословная</option>
                        <option value={SIGN.POLYELEOS}>Полиелейная</option>
                        <option value={SIGN.VIGIL}>Бденная</option>
                        <option value={SIGN.GREAT_VIGIL}>Великое бдение</option>
                    </select>
                </div>
                <div className="flex flex-col">
                    <span>Святой: <b>{title}</b></span>
                </div>
            </div>
        </div>
    )
};

interface ISaintPart {
    signs: Array<ISaintPartItem>;
    setSigns: Dispatch<SetStateAction<Array<ISaintPartItem>>>;
    saveSign: (field: keyof ISaintPartItem, value: string, index: number) => void;
}

export const SaintPart = ({
    signs,
    setSigns,
    saveSign,
}: ISaintPart) => (
    <div className="flex flex-col">
        <label>
            <span className="font-bold">Знаки святых дня</span>
            <span
                className="cursor-pointer text-slate-300"
                onClick={() => {
                    setSigns(old => ([...old, { } as ISaintPartItem]))
                }}
            >
                Добавить в конец
            </span>
        </label>
        <div className="flex flex-row">
            {signs.map((item: any, index: number) => (
                <SaintAddPart
                    key={item.saintId}
                    item={item}
                    index={index}
                    saveSign={saveSign}
                />
            ))}
        </div>
    </div>
);