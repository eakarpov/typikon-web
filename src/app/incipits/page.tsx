import { Suspense } from "react";
import type { Metadata } from "next";
import Content from "./Content";
import { incipitsData } from "./api";
import { myFont } from "@/utils/font";

// Корпус лежит в файле SQLite рядом с приложением и читается синхронно —
// поэтому выборка идёт прямо здесь, без отдельного промиса. Кэшировать страницу
// нельзя: выдача целиком определяется запросом.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Указатель зачинов — Уставные чтения",
    description:
        "Песнопения Октоиха, Миней, Триодей и Ирмология по первым словам: где ещё " +
        "встречается тот же текст и что ему соответствует на греческом, английском " +
        "и румынском. Ударения и церковнославянское написание набирать не нужно.",
};

const Incipits = ({ searchParams }: { searchParams: Record<string, string | undefined> }) => {
    const data = incipitsData(searchParams);

    return (
        <div className={myFont.variable}>
            <Suspense>
                <Content data={data} params={searchParams} />
            </Suspense>
        </div>
    );
};

export default Incipits;
