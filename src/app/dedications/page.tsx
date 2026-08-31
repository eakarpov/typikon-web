import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { myFont } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import { getDedicationsWithCounts } from "@/lib/temples";

// География посвящений — указатель. Здесь всего лишь список; смысл раздела
// раскрывается на странице каждого посвящения, где считаются ареал и волна.

export const metadata: Metadata = {
    title: "География посвящений",
    description:
        "Кому посвящают храмы: где живёт почитание каждого святого и праздника, " +
        "когда оно разошлось и что посвящение говорит о возрасте здания.",
};

const KIND_ORDER = ["gospodskiy", "bogorodichen", "svyatogo"];
const KIND_TITLES: Record<string, string> = {
    gospodskiy: "Господские",
    bogorodichen: "Богородичные",
    svyatogo: "Святых",
};

const List = async () => {
    const items = await getDedicationsWithCounts();

    return (
        <>
            {KIND_ORDER.map((kind) => {
                const group = items.filter((d: any) => d.kind === kind);
                if (!group.length) return null;
                return (
                    <section key={kind} className="mb-5">
                        <h2 className="font-serif text-lg mb-1">{KIND_TITLES[kind]}</h2>
                        <ul className="flex flex-col gap-0.5">
                            {group.map((d: any) => (
                                <li key={d.slug} className="font-serif">
                                    <Link className="text-amber-800 hover:underline" href={`/dedications/${d.slug}`}>
                                        {d.short}
                                    </Link>
                                    <span className="text-sm text-slate-500"> — {d.count}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}
        </>
    );
};

const Dedications = () => {
    setMeta();
    return (
        <div className={`pt-2 ${myFont.variable}`}>
            <p className="font-serif">
                Кому посвящают храмы. У каждого посвящения — где живёт его почитание, когда оно
                разошлось и что оно говорит о возрасте здания.
            </p>
            <p className="font-serif text-sm text-slate-500 mb-4">
                Считается по каталогу храмов; число рядом — сколько их с этим престолом.
            </p>
            <Suspense fallback={<div className="font-serif text-slate-400">Считаю…</div>}>
                <List />
            </Suspense>
        </div>
    );
};

export default Dedications;
