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
 * ВОСЬМИКОНЕЧНЫЙ КРЕСТ РИСУЕТСЯ, А НЕ БЕРЁТСЯ ИЗ ШРИФТА.
 *
 * Знак ☦ (U+2626) есть не во всяком шрифте, и церковнославянские тут не
 * надёжнее прочих: где его нет, браузер подставит что придётся — чаще всего
 * латинский крестик †, четырёхконечный. Записку надписывают не им.
 *
 * Нижняя перекладина косая, и левый её конец ВЫШЕ правого: он указует на
 * благоразумного разбойника, распятого одесную Спасителя, — а одесную Ему
 * приходится налево смотрящему.
 */
const Cross = ({ className = "" }: { className?: string }) => (
    <svg viewBox="0 0 20 34" width="20" height="34" aria-hidden="true"
         className={`inline-block ${className}`}
         fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <line x1="10" y1="2" x2="10" y2="32" />
        <line x1="5.5" y1="7" x2="14.5" y2="7" />
        <line x1="1.5" y1="14" x2="18.5" y2="14" />
        <line x1="3" y1="26.5" x2="17" y2="23.5" />
    </svg>
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
                    <p className="text-center mb-3 text-slate-800">
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
