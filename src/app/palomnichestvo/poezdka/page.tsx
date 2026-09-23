import type { Metadata } from "next";
import { Suspense } from "react";
import { myFont } from "@/utils/font";
import TripView from "./TripView";

// Одна поездка. Разметка у всех одна — поездка берётся из браузера по ?id, —
// и потому страница сохраняется вместе с поездкой и открывается без сети.

export const metadata: Metadata = {
    title: "Поездка — Уставные чтения",
    robots: { index: false, follow: false },
};

const TripPage = () => (
    <div className={`${myFont.variable} pt-2 max-w-3xl`}>
        <Suspense fallback={<p className="font-serif text-slate-500">Открываю поездку…</p>}>
            <TripView />
        </Suspense>
    </div>
);

export default TripPage;
