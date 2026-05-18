import Link from "next/link";
import {useMemo} from "react";

const NobleCard = ({ value, family }: { value: any; family: any}) => {
    const links = useMemo(() => {
        return value.links ? JSON.parse(value.links) : [];
    }, [value]);

    return (
        <div className="flex flex-col p-4">
            <div>
                <b>Имя: </b> {value.name} ({value.nickName})
            </div>
            <div>
                <b>Другие имена:</b> {value.englishName} {value.originalName} <span className="font-sans-serif">{value.csName}</span>
            </div>
            <div>
                <b>Род:</b> <Link href={`/nobles/families/${family?.id}`}>{family?.name}</Link>
            </div>
            <div>
                <b>Пол:</b> {value.gender ? 'М' : 'Ж'}
            </div>
            <div>
                <b>Дата рождения:</b> {value.birthDate}
            </div>
            <div>
                <b>Дата смерти:</b> {value.deathDate}
            </div>
            <div>
                <b>Возраст:</b> {value.deathDate - value.birthDate}
            </div>
            <div>
                <b>Национальность:</b> -
            </div>
            <div>
                <b>Прославлен в лике святых (Православие):</b> {value.isSaintOrthodox ? 'Да': 'Нет'}
            </div>
            <div>
                <b>Прославлен в лике святых (Католичество):</b> {value.isSaintCatholic ? 'Да': 'Нет'}
            </div>
            <div>
                <label><b>Ссылки</b></label>
                {links.map((item) => (
                    <div key={item}>
                        <a href={item} target="_blank" rel="noopener noreferrer">
                            {item}
                        </a>
                    </div>
                ))}
            </div>
            <div>
                <label><b>Краткое описание</b></label>
                <p>{value.info}</p>
            </div>
        </div>
    );
};

export default NobleCard;
