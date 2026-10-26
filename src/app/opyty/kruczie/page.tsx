import type { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import Playground from "./Playground";

export const metadata: Metadata = {
    title: "Крюки и ноты — Опыты — Уставные чтения",
    description: "Проверка перевода строковой крюковой и нотной записи через библиотеку kruczie.",
};

export default function KrucziePage() {
    return (
        <div className={`${myFont.variable} font-serif max-w-4xl`}>
            <Link href="/opyty" className="text-sm underline underline-offset-4">← Опыты</Link>
            <h1 className="font-bold mt-3">Крюки и ноты</h1>
            <p className="text-slate-600 mt-2 mb-5">
                Перевод строковой записи знаменного и демественного распевов по базе известных соответствий.
                Одной мелодии могут отвечать несколько крюковых записей: варианты показаны с источниками.
            </p>
            <Playground />
        </div>
    );
}
