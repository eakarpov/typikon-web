"use client";

import {useEffect, useState} from "react";
import DayPart from "@/app/admin/components/DayPart";
import {TextType} from "@/utils/texts";
import {ISaintPartItem, SaintPart} from "@/app/admin/components/SaintPart";

interface IAdminEditor {
    value: any;
    id: string;
}

interface IDayPartItem { textId: string; cite?: string; description?: string; paschal: boolean; statia?: number; }

const AdminEditor = ({ value, id }: IAdminEditor) => {
    const [subnames, setSubnames] = useState<string[]>(value.subnames || []);
    const [name, setName] = useState(value.name || "");

    const [vespersProkimenon, setVespersProkimenon] = useState(value.vespersProkimenon);
    const [vigil, setVigil] = useState(value.vigil);
    const [paschal, setPaschal] = useState<boolean>(value.paschal === undefined ? true : value.paschal);
    const [kathisma1, setKathisma1] = useState(value.kathisma1);
    const [kathisma2, setKathisma2] = useState(value.kathisma2);
    const [kathisma3, setKathisma3] = useState(value.kathisma3);
    const [ipakoi, setIpakoi] = useState(value.ipakoi);
    const [polyeleos, setPolyeleos] = useState(value.polyeleos);
    const [song3, setSong3] = useState(value.song3);
    const [song6, setSong6] = useState(value.song6);
    const [apolutikaTroparia, setApolutikaTroparia] = useState(value.apolutikaTroparia);
    const [before1h, setBefore1h] = useState(value.before1h);
    const [panagia, setPanagia] = useState(value.panagia);
    const [h1, setH1] = useState(value.h1);
    const [h3, setH3] = useState(value.h3);
    const [h6, setH6] = useState(value.h6);
    const [h9, setH9] = useState(value.h9);
    const [before50, setBefore50] = useState(value.before50);
    const [alias, setAlias] = useState(value.alias || "");

    const [signs, setSigns] = useState(value.signs || []);

    const [index, setIndex] = useState(value.paschal ? (value.weekIndex || 0) : (value.monthIndex || 0));

    const [saved, setIsSaved] = useState(false);

    const saveSign = (field: keyof ISaintPartItem, value: string, index: number) => {
        const newSigns = [...signs];
        newSigns[index][field] = value;
        setSigns(newSigns);
    }

    const setTextField = (itemName: TextType, index: number, field: keyof IDayPartItem, value: string|boolean|number|undefined) => {
        switch (itemName) {
            case TextType.VESPERS_PROKIMENON:
                const newVespersProkimenon = {...vespersProkimenon};
                newVespersProkimenon.items[index][field] = value;
                setVespersProkimenon(newVespersProkimenon);
                return;
            case TextType.VIGIL:
                const newVigil = {...vigil};
                newVigil.items[index][field] = value;
                setVigil(newVigil);
                return;
            case TextType.KATHISMA_1:
                const newKathisma1 = {...kathisma1};
                newKathisma1.items[index][field] = value;
                setKathisma1(newKathisma1);
                return;
            case TextType.KATHISMA_2:
                const newKathisma2 = {...kathisma2};
                newKathisma2.items[index][field] = value;
                setKathisma2(newKathisma2);
                return;
            case TextType.KATHISMA_3:
                const newKathisma3 = {...kathisma3};
                newKathisma3.items[index][field] = value;
                setKathisma3(newKathisma3);
                return;
            case TextType.BEFORE_50:
                const newBefore50 = {...before50};
                newBefore50.items[index][field] = value;
                setBefore50(newBefore50);
                return;
            case TextType.IPAKOI:
                const newIpakoi = {...ipakoi};
                newIpakoi.items[index][field] = value;
                setIpakoi(newIpakoi);
                return;
            case TextType.POLYELEOS:
                const newPolyeleos = {...polyeleos};
                newPolyeleos.items[index][field] = value;
                setPolyeleos(newPolyeleos);
                return;
            case TextType.SONG_3:
                const newSong3 = {...song3};
                newSong3.items[index][field] = value;
                setSong3(newSong3);
                return;
            case TextType.SONG_6:
                const newSong6 = {...song6};
                newSong6.items[index][field] = value;
                setSong6(newSong6);
                return;
            case TextType.APOLUTIKA_TROPARIA:
                const newApolutikaTroparia = {...apolutikaTroparia};
                newApolutikaTroparia.items[index][field] = value;
                setApolutikaTroparia(newApolutikaTroparia);
                return;
            case TextType.BEFORE_1h:
                const newBefore1h = {...before1h};
                newBefore1h.items[index][field] = value;
                setBefore1h(newBefore1h);
                return;
            case TextType.H1:
                const newH1 = {...h1};
                newH1.items[index][field] = value;
                setH1(newH1);
                return;
            case TextType.H3:
                const newH3 = {...h3};
                newH3.items[index][field] = value;
                setH3(newH3);
                return;
            case TextType.H6:
                const newH6 = {...h6};
                newH6.items[index][field] = value;
                setH6(newH6);
                return;
            case TextType.H9:
                const newH9 = {...h9};
                newH9.items[index][field] = value;
                setH9(newH9);
                return;
            case TextType.PANAGIA:
                const newPanagia = {...panagia};
                newPanagia.items[index][field] = value;
                setPanagia(newPanagia);
                return;
            default:
                return;
        }
    };

    const onSubmit = () => {
        setIsSaved(false);
        const body: any = {
            paschal,
            name,
            subnames,
            vespersProkimenon,
            vigil,
            kathisma1,
            kathisma2,
            kathisma3,
            ipakoi,
            polyeleos,
            song3,
            song6,
            apolutikaTroparia,
            before1h,
            h1,
            h3,
            h6,
            h9,
            panagia,
            alias,
            before50,
        };
        if (paschal) {
            body.weekIndex = index;
        } else {
            body.monthIndex = index;
        }
        fetch(`/api/admin/days/${value.id}`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }).then(() => {
            setIsSaved(true);
        });
    };

    return (
        <div className="flex flex-col space-y-1">
            <button onClick={onSubmit}>
                {saved ? "Сохранено!" : "Сохранить"}
            </button>
            {!paschal && (
                <div className="flex flex-row space-x-1">
                    <SaintPart
                        signs={signs}
                        setSigns={setSigns}
                        saveSign={saveSign}
                    />
                </div>
            )}
            <label>
                Триодный круг <span
                className="cursor-pointer font-bold"
                onClick={() => setPaschal(!paschal)}
            >
                {paschal ? "Да" : "Нет"}
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
                    Индекс в {paschal ? 'неделе' : 'месяце'}
                </label>
                <input
                    type="number"
                    className="border-2"
                    value={index}
                    onChange={e => setIndex(parseInt(e.target.value, 10))}
                />
            </div>
            <div className="flex flex-row space-x-1">
                <label>
                    Алиас записи
                </label>
                <input
                    className="border-2"
                    value={alias}
                    onChange={e => setAlias(e.target.value)}
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
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={kathisma1}
                setter={setKathisma1}
                valueName={TextType.KATHISMA_1}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={kathisma2}
                setter={setKathisma2}
                valueName={TextType.KATHISMA_2}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={kathisma3}
                setter={setKathisma3}
                valueName={TextType.KATHISMA_3}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={before50}
                setter={setBefore50}
                valueName={TextType.BEFORE_50}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={ipakoi}
                setter={setIpakoi}
                valueName={TextType.IPAKOI}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={polyeleos}
                setter={setPolyeleos}
                valueName={TextType.POLYELEOS}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={song3}
                setter={setSong3}
                valueName={TextType.SONG_3}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={song6}
                setter={setSong6}
                valueName={TextType.SONG_6}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={apolutikaTroparia}
                setter={setApolutikaTroparia}
                valueName={TextType.APOLUTIKA_TROPARIA}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={before1h}
                setter={setBefore1h}
                valueName={TextType.BEFORE_1h}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={panagia}
                setter={setPanagia}
                valueName={TextType.PANAGIA}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={h3}
                setter={setH3}
                valueName={TextType.H3}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={h6}
                setter={setH6}
                valueName={TextType.H6}
                setTextField={setTextField}
                paschal={paschal}
            />
            <DayPart
                value={h9}
                setter={setH9}
                valueName={TextType.H9}
                setTextField={setTextField}
                paschal={paschal}
            />
        </div>
    );
};

export default AdminEditor;
