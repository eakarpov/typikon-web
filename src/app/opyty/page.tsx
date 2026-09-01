import type { Metadata } from "next";
import { memo } from "react";
import Link from "next/link";
import { myFont } from "@/utils/font";

// Разделы, которые ещё делаются.
//
// Собраны отдельно не для порядка, а чтобы было честно: в шапке рядом с
// чтениями они обещали бы ту же готовность, что и чтения, — а её нет.
// Здесь про каждый сказано, чего ждать и чего пока не ждать.

export const metadata: Metadata = {
    title: "Опыты — Уставные чтения",
    description:
        "Разделы сайта, которые ещё делаются: последование службы по Типикону " +
        "и древо князей и царей.",
};

interface Opyt {
    href: string;
    title: string;
    what: string;
    // Чего именно не хватает. Пишем прямо: раздел, о недоделанности которого
    // сказано общими словами, читатель считает сломанным, а не начатым.
    caveat: string;
}

const OPYTY: Opyt[] = [
    {
        href: "/ustav",
        title: "Последование службы",
        what: "Канва службы по Типикону, наполненная песнопениями книг: кто что произносит, " +
            "откуда взята каждая единица и какое правило поставило её на это место.",
        caveat: "Устав расписан не весь. Пустые места показаны, а не спрятаны, — " +
            "и означают они, что правило для этого места ещё не написано.",
    },
    {
        href: "/nobles",
        title: "Древо князей и царей",
        what: "Родословная русских правителей: связи, годы, места.",
        caveat: "Собрано ввозом из Викиданных и сверено не целиком: связи и даты " +
            "ещё вычитываются, дубликаты сводятся.",
    },
];

const Opyty = () => (
    <div className={myFont.variable}>
        <div className="flex flex-col font-serif max-w-3xl">
            <h1 className="font-bold">Опыты</h1>
            <p className="text-slate-600 mt-1 mb-4">
                Разделы, которые ещё делаются. Они работают, но не закончены, и полагаться
                на них как на книгу пока нельзя — о каждом сказано, чего ждать.
            </p>

            <ul className="flex flex-col gap-4">
                {OPYTY.map(item => (
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

export default memo(Opyty);
