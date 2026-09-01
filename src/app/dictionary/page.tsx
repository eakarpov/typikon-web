import { Suspense } from "react";
import type { Metadata } from "next";
import Content from "@/app/dictionary/Content";
import SearchForm from "@/app/dictionary/SearchForm";
import { searchData } from "@/app/dictionary/api";
import { myFont } from "@/utils/font";

export const metadata: Metadata = {
    title: "Словарь церковнославянского языка — Уставные чтения",
    description:
        "Как церковнославянское слово изменяется: склонение существительных и "
        + "прилагательных, спряжение глаголов — по грамматическим таблицам "
        + "«Грамматического словаря церковнославянского языка».",
    openGraph: {
        title: "Словарь церковнославянского языка",
        description: "Склонение и спряжение церковнославянского слова — парадигма целиком.",
        url: "//www.typikon.su/dictionary/",
    },
};

const Dictionary = ({ searchParams }: { searchParams: { query?: string } }) => {
    const query = searchParams.query;

    return (
        <div className={`${myFont.variable} flex flex-col gap-4 max-w-3xl`}>
            <div className="flex flex-col gap-2">
                <h1 className="font-serif font-bold text-lg">Словарь церковнославянского языка</h1>
                <p className="font-serif">
                    Как слово изменяется: существительное и прилагательное — по падежам,
                    числам и родам, глагол — по лицам, временам и наклонениям. Двойственное
                    число показано наравне с прочими: в богослужебных книгах оно живое.
                </p>
                <p className="font-serif text-slate-600">
                    Парадигмы порождаются по грамматическим таблицам А. Е. Полякова, а формы,
                    выписанные в самом словаре, показываются как есть и стоят впереди
                    порождённых.
                </p>
            </div>

            <Suspense>
                <SearchForm />
            </Suspense>

            {query && (
                <Suspense fallback={<p className="font-serif">Ищем…</p>}>
                    <Content itemsPromise={searchData(query)} />
                </Suspense>
            )}
        </div>
    );
};

export default Dictionary;
