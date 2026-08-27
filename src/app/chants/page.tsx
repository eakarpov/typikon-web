import { Suspense } from "react";
import type { Metadata } from "next";
import Content from "./Content";
import { chantsData } from "./api";
import { myFont } from "@/utils/font";

// Корпус лежит в файле SQLite рядом с приложением, а не в Mongo, и читается
// синхронно — поэтому выборка идёт прямо здесь, без отдельного промиса.
// Кэшировать страницу нельзя: выдача целиком определяется запросом.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Поиск по песнопениям — Уставные чтения",
    description:
        "Стихиры, седальны, тропари и каноны Октоиха, Миней и Триодей — каждое песнопение " +
        "на своём месте службы. Ударения и церковнославянское написание набирать не нужно.",
};

const Chants = ({ searchParams }: { searchParams: Record<string, string | undefined> }) => {
    const data = chantsData(searchParams);

    return (
        <div className={myFont.variable}>
            <Suspense>
                <Content data={data} params={searchParams} />
            </Suspense>
        </div>
    );
};

export default Chants;
