import { Suspense } from "react";
import type { Metadata } from "next";
import { myFont, csFont } from "@/utils/font";
import Content from "./Content";
import { podobnyData } from "./api";

// Указатель подобнов.
//
// Подобен в корпусе живёт строкой в столбце, и строк этих 974 — с опечатками,
// разными написаниями одного имени и тремя языками, не знающими друг о друге.
// Здесь они сведены в 497 единиц; чем и почему — сказано в @/lib/podobny/core.
//
// Корпус лежит в файле SQLite и читается синхронно, поэтому выборка идёт прямо
// здесь, без кэша: указатель считается один раз на процесс и дальше отдаётся
// из памяти.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Подобны — Уставные чтения",
    description:
        "Подобны богослужебных книг: чем поётся стихира, на каком гласе, " +
        "как это имя пишут по-славянски, по-гречески и по-румынски.",
};

const Podobny = ({ searchParams }: { searchParams: Record<string, string | undefined> }) => (
    <div className={`${myFont.variable} ${csFont.variable} pt-2`}>
        <h1 className="font-bold font-serif mb-2">Подобны</h1>
        <Suspense>
            <Content data={podobnyData(searchParams)} params={searchParams} />
        </Suspense>
    </div>
);

export default Podobny;
