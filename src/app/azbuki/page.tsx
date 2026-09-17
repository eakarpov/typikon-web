import type { Metadata } from "next";
import { memo } from "react";
import Link from "next/link";
import { myFont } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import { SITE_URL } from "@/utils/site";

// Азбуки — опыты письма: как записать язык алфавитом, которого у него нет.
//
// Раздел собран отдельно от чтений намеренно. Это не пособие и не предложение
// реформы: каждая азбука здесь — проверяемое построение, у которого видно
// основание и цену. Пока азбука одна.

export const metadata: Metadata = {
    title: "Азбуки — Уставные чтения",
    description:
        "Опыты письма: как записать язык алфавитом, которого у него нет. " +
        "Китайская латиница, выведенная из среднекитайской фонологии «Гуанъюня».",
    openGraph: {
        title: "Азбуки",
        description: "Опыты письма: языки, записанные алфавитом, которого у них нет.",
        url: `${SITE_URL}/azbuki/`,
    },
};

interface Azbuka {
    href: string;
    title: string;
    what: string;
    caveat: string;
}

const AZBUKI: Azbuka[] = [
    {
        href: "/azbuki/chinese",
        title: "Китайский алфавит",
        what: "Латиница, выведенная не из нынешнего произношения, а из среднекитайской " +
            "фонологии «Гуанъюня» (1008 г.). Оттого она различает то, что путунхуа " +
            "давно свёл воедино: 3 801 звучание словаря даёт 3 801 различное написание, " +
            "и ни одно не совпадает с другим — тогда как в пиньине на одно написание " +
            "приходится в среднем пять с половиной иероглифов.",
        caveat: "Это построение, а не письменность в употреблении: по-китайски так " +
            "никто не пишет и не писал. Читать её вслух нельзя — она записывает " +
            "звучание XI века; современное произношение из неё выводится правилами, " +
            "и правила эти верны в 82–86% случаев, а не всегда.",
    },
];

const Azbuki = () => {
    setMeta();

    return (
        <div className={myFont.variable}>
            <div className="flex flex-col font-serif max-w-3xl">
                <h1 className="font-bold">Азбуки</h1>
                <p className="text-slate-600 mt-1 mb-4">
                    Опыты письма: как записать язык алфавитом, которого у него нет. Не
                    пособие и не предложение реформы — каждая азбука здесь построение,
                    у которого видно основание и цену.
                </p>

                <ul className="flex flex-col gap-4">
                    {AZBUKI.map(item => (
                        <li key={item.href}>
                            <Link href={item.href} className="underline underline-offset-4 font-bold">
                                {item.title}
                            </Link>
                            <p className="text-slate-700">{item.what}</p>
                            <p className="text-slate-500 text-sm">{item.caveat}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default memo(Azbuki);
