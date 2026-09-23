import type { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import Trips from "./Trips";

// Поездка: даты и храмы маршрута — и всё, что понадобится в её дни, без сети.
//
// Страница — оболочка: поездки лежат в браузере (@/lib/pilgrimage/trip), и
// сервер о них не знает. Оттого её и можно сохранить: разметка у всех одна.

export const metadata: Metadata = {
    title: "Поездка: чтения на все дни без сети — Уставные чтения",
    description: "Даты и храмы маршрута: чтения на каждый день, престольные праздники и святыни по пути — одним нажатием для чтения без интернета.",
};

const PalomnichestvoPage = () => (
    <div className={`${myFont.variable} pt-2 flex flex-col gap-4 max-w-3xl`}>
        <div>
            <h1 className="font-bold font-serif">Поездка</h1>
            <p className="font-serif text-slate-700 mt-1">
                Укажите даты и храмы маршрута. По каждому дню соберутся чтения, престольные праздники
                храмов на пути и памяти святых, чьи мощи там пребывают, — и всё это можно одним нажатием
                сохранить, чтобы читать там, где нет связи.
            </p>
            <p className="font-serif text-sm text-slate-500 mt-1">
                Поездки хранятся только в этом браузере и на сервер не отправляются. Что рядом с вами
                сейчас — на странице <Link className="text-amber-800 hover:underline" href="/ryadom">«Что рядом»</Link>.
            </p>
        </div>
        <Trips />

        {/* На эту страницу ведёт имя обходчика (TypikonBot) в журналах чужих
            сайтов: владелец сайта должен найти здесь, кто к нему ходил и как
            его остановить. */}
        <section id="typikonbot" className="font-serif text-sm text-slate-600 border-t pt-3 mt-4">
            <h2 className="text-base text-slate-800">Для владельцев сайтов храмов: TypikonBot</h2>
            <p className="mt-1">
                Святыни в поездке берутся из реестра, где каждая запись — с источником. Чтобы узнавать о
                принесённых ковчегах и мощах, TypikonBot изредка читает новости на сайтах храмов из каталога:
                не чаще раза в месяц, не больше двадцати пяти страниц и не чаще страницы в три секунды. Он
                соблюдает robots.txt; запретить его можно строками <code>User-agent: TypikonBot</code> и{" "}
                <code>Disallow: /</code>. Найденное не публикуется само: каждую запись проверяет человек, и
                ссылка на вашу новость остаётся при ней источником.
            </p>
        </section>
    </div>
);

export default PalomnichestvoPage;
