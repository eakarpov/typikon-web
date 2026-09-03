import React from "react";
import Link from "next/link";
import { PAGE_SIZE, type PodobnyPageData } from "./api";
import Filters from "./Filters";
import { bookLanguageShort, needsChurchFont } from "@/utils/bookLanguages";
import { plural } from "@/utils/plural";

const Pager = ({ page, total, params }: {
    page: number; total: number; params: Record<string, string | undefined>;
}) => {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) return null;

    const href = (to: number) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v && k !== "page") next.set(k, v);
        next.set("page", String(to));
        return `/podobny?${next.toString()}`;
    };

    return (
        <div className="flex gap-4 items-baseline font-serif mt-4">
            {page > 1 && <a href={href(page - 1)} className="text-red-900">← назад</a>}
            <span className="text-sm text-slate-500">страница {page} из {pages}</span>
            {page < pages && <a href={href(page + 1)} className="text-red-900">вперёд →</a>}
        </div>
    );
};

const fontFor = (language: string) => (needsChurchFont(language) ? "font-sans-serif" : "");

const Content = ({ data, params }: {
    data: PodobnyPageData; params: Record<string, string | undefined>;
}) => {
    const page = Math.max(1, Number(params.page) || 1);

    if (data.corpusMissing) {
        return (
            <p className="font-serif text-slate-600">
                Корпус певческих текстов на этом сервере пока не выложен.
            </p>
        );
    }

    return (
        <div>
            <p className="font-serif mb-3">
                Подобен — единственный адрес, которым книга сама говорит, как петь: «глас 2,
                подобен: До́ме Евфра́фов» значит «на тот самый напев». Здесь они собраны все, и
                у каждого — стихиры, которые им поются.
            </p>

            <Filters languages={data.languages} tones={data.tones} params={params} />

            <p className="font-serif text-sm text-slate-500 mt-4 mb-2">
                {data.total ? `Подобнов: ${data.total}` : "Под такой отбор ничего не подошло."}
            </p>

            <div className="flex flex-col gap-2">
                {data.items.map((unit) => (
                    <div key={unit.slug} className="border-l-2 border-slate-200 pl-3">
                        <Link href={`/podobny/${unit.slug}`}
                              className={`text-red-900 hover:underline ${fontFor(unit.names[0]?.language ?? "cu_gr")}`}>
                            {unit.names[0]?.printed ?? unit.slug}
                        </Link>
                        {unit.names.length > 1 && (
                            <span className="text-sm text-slate-500">
                                {" · "}
                                {unit.names.slice(1).map((name) => name.printed).join(" · ")}
                            </span>
                        )}
                        <div className="text-xs text-slate-500 font-serif">
                            {[
                                unit.tone ? `глас ${unit.tone}` : null,
                                `${unit.items} ${plural(unit.items, "стихира", "стихиры", "стихир")}`,
                                unit.languages.map((l) => bookLanguageShort(l.code)).join(", "),
                                unit.spellings.length > 1
                                    ? `${unit.spellings.length} ${plural(unit.spellings.length, "написание", "написания", "написаний")}`
                                    : null,
                            ].filter(Boolean).join(" · ")}
                        </div>
                    </div>
                ))}
            </div>

            <Pager page={page} total={data.total} params={params} />
        </div>
    );
};

export default Content;
