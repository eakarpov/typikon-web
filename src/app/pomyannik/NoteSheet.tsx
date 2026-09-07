import React from "react";
import type { PersonKind, Rank, Sex } from "@/lib/pomyannik/types";
import { capitalize, rankChurchGenitive, rankGenitive } from "@/app/pomyannik/labels";

// САМА ЗАПИСКА — тот лист, что подают. Один вид на обе стороны: и тому, кто
// собирает, и тому, кто читает, показывается ровно одно и то же. Две почти
// одинаковые вёрстки завели бы две правды о том, как записка выглядит, и
// разошлись бы они на первой же правке.

export interface SheetName {
    rank: Rank | null;
    sex: Sex;
    /** Имя в том виде, в каком оно ляжет на лист. */
    text: string;
    /** Склонено ли оно нами по словарю. */
    declined: boolean;
}

const HEADING: Record<PersonKind, string> = {
    living: "ѡ҆ здра́вїи",
    departed: "ѡ҆ ᲂу҆поко́енїи",
};

/**
 * ВОСЬМИКОНЕЧНЫЙ КРЕСТ — ЗНАК ☦ (U+2626), А НЕ РИСУНОК.
 *
 * Стоял здесь свой рисунок из отрезков — из опасения, что знака в шрифте не
 * окажется и браузер подставит четырёхконечный латинский †. Опасение снято
 * счётом: знак есть во ВСЕХ четырёх церковнославянских шрифтах, какие сайт
 * даёт читателю на выбор, — в Мономахе, Пономаре, Триоди и Фёдоровском
 * (проверено разбором cmap через lib/csEncoding/font). Своего креста при
 * готовом знаке рисовать незачем: у книжного шрифта он книжной же руки, а
 * наши отрезки — нет.
 *
 * Шрифт при этом обязан быть церковнославянским: в гражданском Old Standard
 * знака НЕТ, и на нём вышел бы как раз подставленный крестик.
 *
 * Начертание сверено растром: у мономахова знака три перекладины — титло,
 * основная и косая подножие, — то есть он восьмиконечный, а не четырёхконечный.
 */
const Cross = () => (
    <span className="font-sans-serif" aria-hidden="true">&#x2626;</span>
);

const Name = ({ name }: { name: SheetName }) => {
    const church = rankChurchGenitive(name.rank, name.sex);
    const civil = rankGenitive(name.rank, name.sex);
    return (
        <li>
            {/* ПОМЕТА СТРОЧНАЯ, ИМЯ — С ПРОПИСНОЙ. С прописной пишут имя
                человека; «болящей», «младенца» — не имя, а чин, и в записке
                они так и стоят. Славянским письмом помета идёт, если оно
                засвидетельствовано книгой; иначе гражданкой, и страница
                говорит об этом словами */}
            {church ? `${church} ` : null}
            {!church && civil
                ? <span className="font-serif text-base">{civil} </span>
                : null}
            {capitalize(name.text)}
        </li>
    );
};

/**
 * КРЕСТ СНИМАЕТСЯ ГАЛОЧКОЙ, и это не прихоть вёрстки.
 *
 * Записку надписывают крестом — так она и выглядит на бумаге. Но лист с
 * крестом уже не выбросишь: его сжигают. Кто печатает записку дома и не хочет
 * этой заботы, вправе крест не ставить, и решать это за него мы не станем.
 */
const NoteSheet = ({ title, groups, cross = true }: {
    title?: string;
    groups: Array<{ section: PersonKind; list: SheetName[] }>;
    cross?: boolean;
}) => (
    <div className="border rounded p-6 bg-white max-w-sm">
        {title && (
            <p className="font-serif text-center text-sm text-slate-600 mb-4">{title}</p>
        )}
        {groups.map(({ section, list }, i) => (
            <section key={section} className={i ? "mt-8" : ""}>
                {cross && (
                    <p className="text-center text-3xl leading-none mb-3 text-slate-800">
                        <Cross />
                    </p>
                )}
                <p className="font-sans-serif text-center text-lg">{HEADING[section]}</p>
                {/* Отступ между надписанием и именами: на бумаге они разделены,
                    и слитая строка читается как продолжение заголовка */}
                <ul className="font-sans-serif text-xl text-center leading-relaxed mt-4">
                    {list.map((name, j) => <Name key={`${name.text}-${j}`} name={name} />)}
                </ul>
            </section>
        ))}
    </div>
);

export default NoteSheet;
