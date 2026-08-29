import React from "react";
import Link from "next/link";
import type { PrayersPageData } from "./api";
import { PAGE_SIZE } from "./api";
import Filters from "./Filters";
import { PRAYER_KIND_LABELS, labelOf } from "@/utils/chantLabels";

const Pager = ({ page, total, params }: {
    page: number; total: number; params: Record<string, string | undefined>;
}) => {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) return null;
    const href = (to: number) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v && k !== "page") next.set(k, v);
        next.set("page", String(to));
        return `/prayers?${next.toString()}`;
    };
    return (
        <div className="flex gap-4 items-baseline font-serif mt-4">
            {page > 1 && <a href={href(page - 1)} className="text-red-900">← назад</a>}
            <span className="text-sm text-slate-500">страница {page} из {pages}</span>
            {page < pages && <a href={href(page + 1)} className="text-red-900">вперёд →</a>}
        </div>
    );
};

const Content = ({ data, params }: {
    data: PrayersPageData; params: Record<string, string | undefined>;
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
                Молитвы книг и молитвы, которые печатаются при акафистах.<br />
                <span className="text-sm text-slate-600">
                    Молитву называет не подпись, а тот, при ком она стоит: почти все они
                    подписаны просто «Моли́тва». Поэтому искать можно и по имени, и по зачину.
                </span>
            </p>

            <Filters facets={data.facets} params={params} />

            <p className="font-serif text-sm text-slate-500 mt-4 mb-2">
                {data.total
                    ? `Молитв: ${data.total}`
                    : "Ничего не нашлось. Попробуйте другое слово или снимите фильтр."}
            </p>

            <div className="flex flex-col gap-3">
                {data.items.map(p => (
                    <div key={p.id} className="flex flex-col">
                        <Link href={`/prayers/${p.id}`} className="font-serif text-red-900">
                            {p.owner || p.title || "Молитва"}
                        </Link>
                        <div className="text-xs text-slate-500 font-serif">
                            {[
                                p.title || "Молитва",
                                labelOf(PRAYER_KIND_LABELS, p.kind),
                            ].filter(Boolean).join(" · ")}
                        </div>
                        {/* Зачин в списке — не украшение: две молитвы одному святому
                            подписаны одинаково, и различает их только начало текста. */}
                        <p className="font-serif text-slate-700 text-sm">{p.incipit}…</p>
                    </div>
                ))}
            </div>

            <Pager page={page} total={data.total} params={params} />
        </div>
    );
};

export default Content;
