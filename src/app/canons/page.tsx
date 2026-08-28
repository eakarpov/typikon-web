import { Suspense } from "react";
import type { Metadata } from "next";
import Content from "./Content";
import { canonsData } from "./api";
import { myFont } from "@/utils/font";

// Корпус лежит в файле SQLite рядом с приложением и читается синхронно —
// поэтому выборка идёт прямо здесь, без отдельного промиса. Кэшировать
// страницу нельзя: выдача целиком определяется запросом.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Каноны — Уставные чтения",
    description:
        "Каноны Октоиха, Миней, Триодей и Минеи общей — каждый целиком, со всеми песнями. " +
        "Поиск по тому, кому канон и чьё он творение.",
};

const Canons = ({ searchParams }: { searchParams: Record<string, string | undefined> }) => (
    <div className={myFont.variable}>
        <Suspense>
            <Content data={canonsData(searchParams)} params={searchParams} />
        </Suspense>
    </div>
);

export default Canons;
