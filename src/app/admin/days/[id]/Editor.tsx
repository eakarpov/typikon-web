"use client";

import {useState} from "react";
import DayPart from "@/app/admin/components/DayPart";
import {TextType} from "@/utils/texts";

const AdminEditor = ({ value }: any) => {
    const [subnames, setSubnames] = useState<string[]>(value.subnames || []);
    const [name, setName] = useState(value.name || "");
    const [vigil, setVigil] = useState(value.vigil);
    const [triodic, setTriodic] = useState(value.triodic || true);
    const [kathisma1, setKathisma1] = useState(value.kathisma1);
    const [kathisma2, setKathisma2] = useState(value.kathisma2);
    const [kathisma3, setKathisma3] = useState(value.kathisma3);
    const [ipakoi, setIpakoi] = useState(value.ipakoi);
    const [polyeleos, setPolyeleos] = useState(value.polyeleos);
    const [song3, setSong3] = useState(value.song3);
    const [song6, setSong6] = useState(value.song6);
    const [before1h, setBefore1h] = useState(value.before1h);
    const [panagia, setPanagia] = useState(value.panagia);
    const [weekIndex, setWeekIndex] = useState(value.weekIndex || 0);

    const setTextCite = (itemName: TextType, index: number, value: string) => {
        switch (itemName) {
            case TextType.SONG_3:
                const newSong3 = {...song3};
                newSong3.items[index].cite = value;
                setSong3(newSong3);
                return;
            case TextType.SONG_6:
                const newSong6 = {...song6};
                newSong6.items[index].cite = value;
                setSong6(newSong6);
                return;
            default:
                return;
        }
    };

    const setTextId = (itemName: TextType, index: number, value: string) => {
        switch (itemName) {
            case TextType.SONG_3:
                const newSong3 = {...song3};
                newSong3.items[index].textId = value;
                setSong3(newSong3);
                return;
            case TextType.SONG_6:
                const newSong6 = {...song6};
                newSong6.items[index].textId = value;
                setSong6(newSong6);
                return;
            default:
                return;
        }
    };

    const onSubmit = () => {
        fetch(`/api/admin/days/${value.id}`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                subnames,
                vigil,
                kathisma1,
                kathisma2,
                kathisma3,
                ipakoi,
                polyeleos,
                song3,
                song6,
                before1h,
                panagia,
                weekIndex,
            }),
        });
    };
    return (
        <div className="flex flex-col space-y-1">
            <button onClick={onSubmit}>
                Готово
            </button>
            <label>
                Триодный круг <span
                className="cursor-pointer font-bold"
                onClick={() => setTriodic(!triodic)}
            >
                {triodic ? "Да" : "Нет"}
            </span>
            </label>
            <label>
                Название
            </label>
            <input
                className="border-2"
                value={name}
                onChange={e => setName(e.target.value)}
            />
            <div className="flex flex-row space-x-1">
                <label>
                    Индекс в недели
                </label>
                <input
                    type="number"
                    className="border-2"
                    value={weekIndex}
                    onChange={e => setWeekIndex(parseInt(e.target.value, 10))}
                />
            </div>
            <label>
                Дополнительные названия <span
                    className="cursor-pointer"
                    onClick={() => {
                        setSubnames([...subnames, ""]);
                    }}
                >Добавить</span>
            </label>
            {subnames.map((sName: string, index: number) => (
                <div key={sName}>
                    <input
                        className="border-2"
                        value={sName}
                        onChange={e => {
                            const sNames = [...subnames];
                            sNames[index] = e.target.value;
                            setSubnames(sNames);
                        }}
                    />
                    <span
                        onClick={() => {
                            const sNames = [...subnames];
                            sNames.splice(index, 1);
                            setSubnames(sNames)
                        }}
                    >
                        Удалить
                    </span>
                </div>
            ))}
            <DayPart
                value={vigil}
                setter={setVigil}
                valueName={TextType.VIGIL}
                setTextCite={setTextCite}
                setTextId={setTextId}
                triodic={triodic}
            />
            <DayPart
                value={kathisma1}
                setter={setKathisma1}
                valueName={TextType.KATHISMA_1}
                setTextCite={setTextCite}
                setTextId={setTextId}
                triodic={triodic}
            />
            <DayPart
                value={kathisma2}
                setter={setKathisma2}
                valueName={TextType.KATHISMA_2}
                setTextCite={setTextCite}
                setTextId={setTextId}
                triodic={triodic}
            />
            <DayPart
                value={kathisma3}
                setter={setKathisma3}
                valueName={TextType.KATHISMA_3}
                setTextCite={setTextCite}
                setTextId={setTextId}
                triodic={triodic}
            />
            <DayPart
                value={ipakoi}
                setter={setIpakoi}
                valueName={TextType.IPAKOI}
                setTextCite={setTextCite}
                setTextId={setTextId}
                triodic={triodic}
            />
            <DayPart
                value={polyeleos}
                setter={setPolyeleos}
                valueName={TextType.POLYELEOS}
                setTextCite={setTextCite}
                setTextId={setTextId}
                triodic={triodic}
            />
            <DayPart
                value={song3}
                setter={setSong3}
                valueName={TextType.SONG_3}
                setTextCite={setTextCite}
                setTextId={setTextId}
                triodic={triodic}
            />
            <DayPart
                value={song6}
                setter={setSong6}
                valueName={TextType.SONG_6}
                setTextCite={setTextCite}
                setTextId={setTextId}
                triodic={triodic}
            />
            <DayPart
                value={before1h}
                setter={setBefore1h}
                valueName={TextType.BEFORE_1h}
                setTextCite={setTextCite}
                setTextId={setTextId}
                triodic={triodic}
            />
            <DayPart
                value={panagia}
                setter={setPanagia}
                valueName={TextType.PANAGIA}
                setTextCite={setTextCite}
                setTextId={setTextId}
                triodic={triodic}
            />
        </div>
    );
};

export default AdminEditor;
