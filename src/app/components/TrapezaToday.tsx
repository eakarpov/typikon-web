'use client';
import { useEffect, useState } from "react";
import Link from "next/link";

// «Трапеза сегодня» на странице дня — одной строкой.
//
// Молчит куда чаще, чем говорит, и это нарочно:
//   * не ответил движок — день от этого не портится;
//   * главы книги о дне расходятся — спор в строку не сжать, и вместо ответа
//     зовём на разбор;
//   * вышло «поста нет» нашим собственным выводом, а не словом книги —
//     повторять его полтораста раз в год там, где оговорке нет места, значит
//     твердить его чаще всего, что книга действительно сказала.
//
// Оформление тише престольного блока: престол меняет службу, трапеза
// дополняет день.

interface Answer {
    kind: "verdict" | "disputed" | "silent";
    line: string | null;
    href: string;
}

const TrapezaToday = ({ date }: { date: string }) => {
    const [answer, setAnswer] = useState<Answer | null>(null);

    useEffect(() => {
        let alive = true;
        fetch(`/api/trapeza?date=${encodeURIComponent(date)}`)
            .then(r => (r.ok ? r.json() : null))
            .then(data => { if (alive && data?.line) setAnswer(data); })
            .catch(() => undefined);
        return () => { alive = false; };
    }, [date]);

    if (!answer?.line) return null;

    return (
        <div className="font-serif border-l-4 border-slate-300 pl-3 my-3">
            <div>
                <strong>Трапеза по Типикону:</strong> {answer.line}.
            </div>
            <div className="text-sm text-slate-500">
                монастырское правило;{" "}
                <Link className="text-red-900 hover:underline" href={answer.href}>
                    глава и цитата →
                </Link>
            </div>
        </div>
    );
};

export default TrapezaToday;
