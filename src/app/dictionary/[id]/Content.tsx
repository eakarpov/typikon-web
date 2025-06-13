import React from "react";
import decline from "@/app/dictionary/[id]/utils";

const labels = {
    A: "прилагательное",
    S: "существительное",
    m: "мужской род",
    anim: "одушевлённое",
    persn: "личное имя"
}

const getItem = (base: string, endings: string[][], index: number) => endings[index].length
    ? `${endings[index].map(end => `${base}${end}`).join(" / ")}`
    : '-';

const Declension = ({ declension }) => {
    const ends = declension.endings || [];
    const base = declension.base || "";
    return (
        <div>
            <p>
                Склонение слова "{declension.normal}"
            </p>
            <div className="grid grid-cols-4 gap-4">
                <div></div><div><b>Ед. ч.</b></div><div><b>Дв. ч.</b></div><div><b>Мн. ч.</b></div>
                <div><b>Им.п.</b></div><div>{declension.normal}</div><div>{getItem(base, ends, 7)}</div><div>{getItem(base, ends, 14)}</div>
                <div><b>Род.п.</b></div><div>{getItem(base, ends, 1)}</div><div>{getItem(base, ends, 8)}</div><div>{getItem(base, ends, 15)}</div>
                <div><b>Вин.п.</b></div><div>{getItem(base, ends, 2)}</div><div>{getItem(base, ends, 9)}</div><div>{getItem(base, ends, 16)}</div>
                <div><b>Дат.п.</b></div><div>{getItem(base, ends, 3)}</div><div>{getItem(base, ends, 10)}</div><div>{getItem(base, ends, 17)}</div>
                <div><b>Тв.п.</b></div><div>{getItem(base, ends, 4)}</div><div>{getItem(base, ends, 11)}</div><div>{getItem(base, ends, 18)}</div>
                <div><b>Пред.п.</b></div><div>{getItem(base, ends, 5)}</div><div>{getItem(base, ends, 12)}</div><div>{getItem(base, ends, 19)}</div>
                <div><b>Зв.п.</b></div><div>{getItem(base, ends, 6)}</div><div>{getItem(base, ends, 13)}</div><div>{getItem(base, ends, 20)}</div>
            </div>
        </div>
    );
}

const Conjugation = ({ conjugation }) => {
    return (
        <div>
            <p>
                Спряжение
            </p>
        </div>
    );
};

interface IError {
    error: string;
}

interface IContent {
    itemsPromise: Promise<[any, IError?]>
}

const Content = async ({ itemsPromise }: IContent) => {

    const [item, error] = await itemsPromise;

    if (error) return null;

    if (!item) return null;

    const declension = decline(item, item.scheme);

    const props = item.properties?.split(",");

    return (
        <div className="font-serif">
            <p>
                Слово - <span className="font-bold">
                    {item.name}
                </span>
            </p>
            <p>
                Свойства - {props.map((el: keyof typeof labels) => labels[el]).join(",")}
            </p>
            {(props.includes("S") || props.includes("A")) && declension && (
                <Declension declension={declension} />
            )}
            {props.includes("V") && declension && (
                <Conjugation conjugation={declension} />
            )}
        </div>
    );
};

export default Content;