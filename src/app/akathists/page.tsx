import { Suspense } from "react";
import type { Metadata } from "next";
import Content from "./Content";
import { akathistsData } from "./api";
import { myFont } from "@/utils/font";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Акафисты — Уставные чтения",
    description:
        "Акафисты корпуса — каждый целиком, все кондаки и икосы подряд. " +
        "Поиск по тому, кому акафист.",
};

const Akathists = ({ searchParams }: { searchParams: Record<string, string | undefined> }) => (
    <div className={myFont.variable}>
        <Suspense>
            <Content data={akathistsData(searchParams)} params={searchParams} />
        </Suspense>
    </div>
);

export default Akathists;
