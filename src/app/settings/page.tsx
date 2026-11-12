import CommemorationSettings from "./CommemorationSettings";
import Link from "next/link";
import { MAX_PERSONS, MAX_BATCH } from "@/lib/pomyannik/types";
import React from "react";
import {Metadata} from "next";
import {myFont} from "@/utils/font";
import ReadingSettings from "@/app/settings/ReadingSettings";
import OfflinePages from "@/app/settings/OfflinePages";

export const metadata: Metadata = {
    title: "Настройки чтения",
    description: "Размер текста, междустрочный интервал, ширина колонки, цвета и отложенное для чтения без интернета.",
};

const Settings = () => (
    <div className={`${myFont.variable} pt-2`}>
        <h2 className="font-serif font-bold text-lg">Настройки чтения</h2>
        <ReadingSettings />
        <h2 className="font-serif font-bold text-lg mt-8">Чтение без интернета</h2>
        <p className="font-serif text-sm text-slate-500 mt-1 mb-2">
            Хранится в самом браузере и никуда не отправляется. Очистка данных сайта
            убирает отложенное вместе со всем остальным.
        </p>
        <OfflinePages />
        <h2 className="font-serif font-bold text-lg mt-8">Помянник</h2>
        <p className="font-serif text-sm text-slate-500 mt-1">
            До {MAX_PERSONS.toLocaleString("ru-RU")} действующих записей, до {MAX_BATCH} имён за один импорт.
            Удалённые записи в корзине не занимают этот лимит.{" "}
            <Link href="/pomyannik" className="underline">Настройки и заполнение помянника</Link>.
        </p>
        <CommemorationSettings />
    </div>
);

export default Settings;
