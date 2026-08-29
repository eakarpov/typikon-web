import { Suspense } from "react";
import type { Metadata } from "next";
import Content from "./Content";
import { prayersData } from "./api";
import { myFont } from "@/utils/font";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Молитвы — Уставные чтения",
    description:
        "Молитвы книг и молитвы при акафистах — целиком, с поиском по тому, " +
        "при ком молитва напечатана.",
};

const Prayers = ({ searchParams }: { searchParams: Record<string, string | undefined> }) => (
    <div className={myFont.variable}>
        <Suspense>
            <Content data={prayersData(searchParams)} params={searchParams} />
        </Suspense>
    </div>
);

export default Prayers;
