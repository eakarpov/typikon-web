import { Suspense } from "react";
import type { Metadata } from "next";
import { myFont } from "@/utils/font";
import Content from "@/app/dictionary/[id]/Content";
import { getItem } from "@/app/dictionary/[id]/api";

export const metadata: Metadata = {
    title: "Словарь церковнославянского языка — Уставные чтения",
    description: "Склонение и спряжение церковнославянского слова: парадигма целиком, "
        + "с формами, выписанными в словаре, и порождёнными по грамматическим таблицам.",
};

const DictionaryItem = ({ params: { id } }: { params: { id: string } }) => {
    const data = getItem(id);

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div className="font-serif">Загружаем…</div>}>
                <Content itemsPromise={data} />
            </Suspense>
        </div>
    );
};

export default DictionaryItem;
