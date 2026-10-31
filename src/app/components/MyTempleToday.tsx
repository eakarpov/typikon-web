'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMyTemple } from "./MyTempleProvider";

// «В вашем храме сегодня». Ради этой строки и заводился каталог: престол —
// параметр службы, и в свой день он поднимает её знак по храмовой главе
// (Типикон, гл. 61).
//
// Молчит, пока храм не назван, и молчит в обычные дни: отметка, горящая
// всегда, перестаёт что-либо значить.

interface Answer {
    temple: { slug: string; name: string };
    prestol: { label: string; isMain: boolean; status: string } | null;
    feast: { note: string | null; movable: boolean; memoryLabel: string | null; signLabel: string | null } | null;
}

const MyTempleToday = ({ date }: { date: string }) => {
    const {temple: mine, owner} = useMyTemple();
    const slug = mine?.slug;
    const [answer, setAnswer] = useState<(Answer & {forDate:string}) | null>(null);

    useEffect(() => {
        setAnswer(null);
        if (!slug) return;
        let alive = true;
        fetch(`/api/temples/feast?slug=${encodeURIComponent(slug)}&date=${date}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => { if (alive && data?.feast) setAnswer({...data,forDate:date}); })
            // Отметка — украшение дня, а не сам день: не ответила, и ладно.
            .catch(() => undefined);
        return () => { alive = false; };
    }, [date, slug, owner]);

    if (!mine || answer?.temple.slug !== mine.slug || answer.forDate !== date || !answer.feast || !answer.prestol) return null;

    return (
        <div className="font-serif border-l-4 border-amber-800 pl-3 my-3">
            <div>
                Сегодня престольный праздник вашего храма:{" "}
                <Link className="text-amber-800 hover:underline" href={`/temples/${answer.temple.slug}`}>
                    {answer.temple.name}
                </Link>
            </div>
            <div className="text-sm text-slate-600">
                {answer.prestol.label}
                {answer.feast.signLabel && ` — служба со знаком «${answer.feast.signLabel}»`}
                {answer.feast.movable && "; день подвижный, считается от Пасхи"}
            </div>
            {answer.prestol.status !== "approved" && (
                <div className="text-sm text-slate-500">
                    Престол выведен из названия храма и не выверен.
                </div>
            )}
        </div>
    );
};

export default MyTempleToday;
