import type { Metadata } from "next";
import Link from "next/link";
import { csFontVariables, myFont } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import { SITE_URL } from "@/utils/site";
import Reference from "./Reference";
import Translit from "./Translit";

// Чувашская церковная азбука.
//
// В отличие от двух других здешних азбук эта не придумывает языку письмо, а
// переодевает существующее: чувашская кириллица получает церковный облик, и
// почти каждое решение подтверждено печатью 1873 года.

export const metadata: Metadata = {
    title: "Чувашская церковная азбука — Уставные чтения",
    description:
        "Церковный облик чувашского письма: ӑ и ӗ возвращаются к ерам, ӳ к ижице, " +
        "ҫ к щ, мягкость метится каморой. Правила проверены по казанской печати 1873 года " +
        "с предисловием Яковлева. Живой перевод текста.",
    openGraph: {
        title: "Чувашская церковная азбука",
        description:
            "Не новая письменность, а церковный облик для существующей: буквы " +
            "возвращаются к той работе, которую и вели.",
        url: `${SITE_URL}/azbuki/chuvash/`,
    },
};

const ChuvashAlphabet = () => {
    setMeta();

    return (
        <div className={`${myFont.variable} ${csFontVariables} pt-2 flex flex-col gap-6`}>
            <div className="flex flex-col gap-2 max-w-3xl">
                <h1 className="font-serif font-bold text-lg">Чувашская церковная азбука</h1>
                <p className="font-serif">
                    Не новая письменность, а церковный облик для существующей. Замены не
                    придуманы: <span>ӑ</span> и <span>ӗ</span> — редуцированные гласные заднего
                    и переднего ряда, то есть ровно то, чем были еры <span>ъ</span> и{" "}
                    <span>ь</span>; <span>ӳ</span> звучит как греческий ипсилон, отчего пишется
                    ижицей; <span>ҫ</span> — то же долгое [ɕ], что и русское щ. Мягкость метится
                    знаком на самой согласной, а не буквой следом.
                </p>
                <p className="font-serif text-slate-600">
                    Почти каждое решение подтверждено печатью: <strong>Казань, 1873</strong>,
                    Евангелие от Матфея с предисловием И. Я. Яковлева — первая книга его новой
                    азбуки. Там уже нет немого ера, йотация пишется через <span>й</span>, а
                    греческие буквы держат имена. Цена каждого решения измерена по корпусу в
                    617 тысяч токенов.
                </p>
                <p className="font-serif text-sm text-slate-500">
                    Раздел из{" "}
                    <Link href="/opyty" className="text-amber-800 hover:underline">Опытов</Link>
                    {" — "}он работает, но не закончен. Другие азбуки — в{" "}
                    <Link href="/azbuki" className="text-amber-800 hover:underline">общем списке</Link>.
                </p>
            </div>

            <Translit />
            <Reference />
        </div>
    );
};

export default ChuvashAlphabet;
