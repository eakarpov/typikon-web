'use client';

import React, {useCallback, useEffect, useState} from "react";
import NobleItem from "@/app/admin/nobles/[id]/NobleItem";
import StateItem from "@/app/admin/nobles/[id]/StateItem";
import FamilyItem from "@/app/admin/nobles/[id]/FamilyItem";
import NationalityItem from "@/app/admin/nobles/[id]/NationalityItem";
import RuleItem from "./RuleItem";

const AdminEditor = ({ value }: any) => {
    const [name, setName] = useState(value.name || "");
    const [englishName, setEnglishName] = useState(value.englishName || "");
    const [originalName, setOriginalName] = useState(value.originalName || "");
    const [familyId, setFamilyId] = useState(value.familyId || "");
    const [defaultNationalityId, setDefaultNationalityId] = useState(value.defaultNationalityId || "");
    const [birthDate, setBirthDate] = useState(value.birthDate || "");
    const [deathDate, setDeathDate] = useState(value.deathDate || "");
    const [fatherId, setFatherId] = useState(value.fatherId || "");
    const [motherId, setMotherId] = useState(value.motherId || "");
    const [isSaintOrthodox, setIsSaintOrthodox] = useState(value.isSaintOrthodox || 0);
    const [isSaintCatholic, setIsSaintCatholic] = useState(value.isSaintCatholic || 0);
    const [gender, setGender] = useState(value.gender || 0);
    const [nickName, setNickName] = useState(value.nickName || "");
    const [churchName, setChurchName] = useState(value.churchName || "");
    const [csName, setCsName] = useState(value.csName || "");
    const [info, setInfo] = useState(value.info || "");
    const [birthDateMarker, setBirthDateMarker] = useState(value.birthDateMarker || 0);
    const [deathDateMarker, setDeathDateMarker] = useState(value.deathDateMarker || 0);
    const [rank, setRank] = useState(value.rank || 0);

    const [saved, setSaved] = useState<boolean>(false);

    useEffect(() => {
        if (birthDate && birthDate !== value.birthDate) {
            setBirthDateMarker(parseInt(birthDate));
        }
    }, [birthDate, value]);

    useEffect(() => {
        if (deathDate && deathDate !== value.deathDate) {
            setDeathDateMarker(parseInt(deathDate));
        }
    }, [deathDate, value]);

    const [spouses, setSpouses] = useState<any[]>([]);

    const onAddSpouse = useCallback(() => {
        setSpouses((old) => [...old, { person: null }]);
    }, [setSpouses]);

    const onDeleteSpouse = useCallback((index: number) => () => {
        setSpouses((old) => old.filter((item, i) => i !== index));
    }, []);

    const setSpouse = (index: number, key: string) => (val: any) => {
        setSpouses((old) => {
            return old.map((item, i) => {
                if (i === index) {
                    return {
                        ...item,
                        [key]: key === "person" ? val : val.target.value,
                    };
                }
                return item;
            })
        });
    };

    useEffect(() => {
        fetch(`/api/admin/nobles/${value.id}/spouses`)
            .then((res) => res.json())
            .then((data) => {
            setSpouses(data.data.map(((item: any) => {
                return item.husbandId === value.id ? {
                    person: item.wifeId,
                    marriageDate: item.marriageDate,
                    divorceDate: item.divorceDate,
                } : {
                    person: item.husbandId,
                    marriageDate: item.marriageDate,
                    divorceDate: item.divorceDate,
                };
            })))
        });
        fetch(`/api/admin/nobles/${value.id}/rules`)
            .then((res) => res.json())
            .then((data) => {
                setRules(data.data);
            });
    }, [value]);

    const [rules, setRules] = useState<any[]>([]);

    const onAddRule = useCallback(() => {
        setRules((old) => [...old, { state: null }]);
    }, [setRules]);

    const setRule = (index: number, key: string, isText = false) => (val: any) => {
        setRules((old) => {
            return old.map((item, i) => {
                if (i === index) {
                    return {
                        ...item,
                        [key]: isText ? val.target.value : val,
                    };
                }
                return item;
            })
        });
    };

    const onDeleteRule = useCallback((index: number) => () => {
        setRules((old) => old.filter((item, i) => i !== index));
    }, []);

    const onSubmit = () => {
        setSaved(false);
        fetch(`/api/admin/nobles/${value.id}/spouses`, {
            method: "POST",
            body: JSON.stringify(spouses)
        });
        fetch(`/api/admin/nobles/${value.id}/rules`, {
            method: "POST",
            body: JSON.stringify(rules),
        })
        fetch(`/api/admin/nobles/${value.id}`, {
            method: "POST",
            body: JSON.stringify({
                name,
                englishName,
                originalName,
                gender,
                birthDate,
                deathDate,
                fatherId,
                motherId,
                familyId: familyId,
                defaultNationalityId,
                isSaintOrthodox,
                isSaintCatholic,
                csName,
                nickName,
                churchName,
                info,
                birthDateMarker,
                deathDateMarker,
                rank,
            }),
        }).then(() => {
            setSaved(true);
        });
    };

    return (
        <div id="text-editor" className="flex flex-col">
            <button onClick={onSubmit}>
                {saved ? "Сохранено!" : "Сохранить"}
            </button>
            <div className="flex flex-row pr-4">
                <FamilyItem
                    placeholder="Родовое имя"
                    value={familyId}
                    setValue={setFamilyId}
                />
                <div className="flex flex-col pr-4">
                    <label>
                        Имя (русское)
                    </label>
                    <input
                        className="border-2"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Имя (ЦС)
                    </label>
                    <input
                        className="border-2"
                        value={csName}
                        onChange={e => setCsName(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Имя (English)
                    </label>
                    <input
                        className="border-2"
                        value={englishName}
                        onChange={e => setEnglishName(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Имя (родное)
                    </label>
                    <input
                        className="border-2"
                        value={originalName}
                        onChange={e => setOriginalName(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                       Прозвище
                    </label>
                    <input
                        className="border-2"
                        value={nickName}
                        onChange={e => setNickName(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex flex-row pr-4">
                <div className="flex flex-col pr-4">
                    <label>
                        Дата рождения
                    </label>
                    <input
                        className="border-2"
                        value={birthDate}
                        onChange={e => setBirthDate(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Дата смерти
                    </label>
                    <input
                        className="border-2"
                        value={deathDate}
                        onChange={e => setDeathDate(e.target.value)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Пол (М - вкл, Ж - выкл)
                    </label>
                    <input
                        className="border-2"
                        type="checkbox"
                        checked={!!gender}
                        onChange={e => setGender(e.target.checked ? 1 : 0)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Дата рождения маркер
                    </label>
                    <input
                        className="border-2"
                        value={birthDateMarker}
                        type="number"
                        onChange={e => setBirthDateMarker(parseInt(e.target.value))}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Дата смерти маркер
                    </label>
                    <input
                        className="border-2"
                        type="number"
                        value={deathDateMarker}
                        onChange={e => setDeathDateMarker(parseInt(e.target.value))}
                    />
                </div>
            </div>
            <div className="flex flex-row flex-wrap">
                <NobleItem
                  placeholder="Отец"
                  value={fatherId}
                  setValue={setFatherId}
                />
                <NobleItem
                    placeholder="Мать"
                    value={motherId}
                    setValue={setMotherId}
                />
                <NationalityItem
                  placeholder="Национальность по умолчанию (если нет родителей)"
                  value={defaultNationalityId}
                  setValue={setDefaultNationalityId}
                />
                <div className="flex flex-col pr-4">
                    <label>
                        Ранг
                    </label>
                    <input
                        className="border-2"
                        type="number"
                        value={rank}
                        onChange={(e) => setRank(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex flex-row pr-4">
                <div className="flex flex-col pr-4">
                    <label>
                        Святой в Православии
                    </label>
                    <input
                        className="border-2"
                        type="checkbox"
                        checked={!!isSaintOrthodox}
                        onChange={e => setIsSaintOrthodox(e.target.checked ? 1 : 0)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Святой в Католичестве
                    </label>
                    <input
                        className="border-2"
                        type="checkbox"
                        checked={!!isSaintCatholic}
                        onChange={e => setIsSaintCatholic(e.target.checked ? 1 : 0)}
                    />
                </div>
                <div className="flex flex-col pr-4">
                    <label>
                        Имя в крещении
                    </label>
                    <input
                        className="border-2"
                        value={churchName}
                        onChange={e => setChurchName(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex flex-row pr-4">
                <div className="flex flex-col pr-4">
                    <label>
                        Текстовая информация
                    </label>
                    <textarea
                        className="border-2"
                        value={info}
                        onChange={e => setInfo(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex flex-col flex-wrap">
                <div onClick={onAddSpouse}>
                    Добавить супруга
                </div>
                {spouses.map((spouse, index) => (
                    <div key={index} className="flex flex-row pr-4">
                        <NobleItem
                            placeholder={`Супруг ${index + 1}`}
                            value={spouse.person}
                            setValue={setSpouse(index, "person")}
                        />
                        <div className="flex flex-col pr-4">
                            <label>
                                Дата женитьбы
                            </label>
                            <input
                                className="border-2"
                                value={spouse.marriageDate}
                                onChange={setSpouse(index, "marriageDate")}
                            />
                        </div>
                        <div className="flex flex-col pr-4">
                            <label>
                                Дата развода (если до смерти - пустота)
                            </label>
                            <input
                                className="border-2"
                                value={spouse.divorceDate}
                                onChange={setSpouse(index, "divorceDate")}
                            />
                        </div>
                        <div onClick={onDeleteSpouse(index)}>
                            X
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex flex-col flex-wrap">
                <div onClick={onAddRule}>
                    Добавить правление
                </div>
                {rules.map((spouse, index) => (
                    <div key={index} className="flex flex-row pr-4">
                        <StateItem
                            placeholder={`Державственность ${index + 1}`}
                            value={spouse.stateId}
                            setValue={setRule(index, "stateId")}
                        />
                        <RuleItem
                            placeholder={`Предшествующее правление ${index + 1}`}
                            value={spouse.predessorId}
                            setValue={setRule(index, "predessorId")}
                        />
                        <NobleItem
                            placeholder={`Наследник ${index + 1}`}
                            value={spouse.heirId}
                            setValue={setRule(index, "heirId")}
                        />
                        <StateItem
                            placeholder={`Сюзерен (державность) ${index + 1}`}
                            value={spouse.suzerainId}
                            setValue={setRule(index, "suzerainId")}
                        />
                        <div className="flex flex-col pr-4">
                            <label>
                                Дата начала правления
                            </label>
                            <input
                                className="border-2"
                                value={spouse.startDate}
                                onChange={setRule(index, "startDate", true)}
                            />
                        </div>
                        <div className="flex flex-col pr-4">
                            <label>
                                Дата окончания правления
                            </label>
                            <input
                                className="border-2"
                                value={spouse.endDate}
                                onChange={setRule(index, "endDate", true)}
                            />
                        </div>
                        <div className="flex flex-col pr-4">
                            <label>
                                Должность на посту (если отличается)
                            </label>
                            <input
                                className="border-2"
                                value={spouse.title}
                                onChange={setRule(index, "title", true)}
                            />
                        </div>
                        <NobleItem
                            placeholder={`Регент ${index + 1}`}
                            value={spouse.regentId}
                            setValue={setRule(index, "regentId")}
                        />
                        <div className="flex flex-col pr-4">
                            <label>
                                Должность регента
                            </label>
                            <input
                                className="border-2"
                                value={spouse.regentTitle}
                                onChange={setRule(index, "regentTitle", true)}
                            />
                        </div>
                        <div onClick={onDeleteRule(index)}>
                            X
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default AdminEditor;
