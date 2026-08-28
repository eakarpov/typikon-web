import React from "react";
import Link from "next/link";
import type { AkathistsPageData } from "./api";
import { PAGE_SIZE } from "./api";
import Filters from "./Filters";
import { AKATHIST_STATUS_LABELS, SUBJECT_KIND_LABELS, labelOf } from "@/utils/chantLabels";

// Серверный компонент: он читает корпус через ./api, и клиентским ему быть
// нельзя — better-sqlite3 в браузерный бандл не помещается (см. ./Filters.tsx).

const Pager = ({ page, total, params }: {
    page: number; total: number; params: Record<string, string | undefined>;
}) => {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) return null;
    const href = (to: number) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v && k !== "page") next.set(k, v);
        next.set("page", String(to));
        return `/akathists?${next.toString()}`;
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
    data: AkathistsPageData; params: Record<string, string | undefined>;
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
                Акафисты корпуса — каждый целиком, все кондаки и икосы подряд.<br />
                {/* Сказать это надо прямо и здесь: раздел похож на устав, но им не
                    является. Уставом положен один акафист, остальные в службы
                    не идут, и обещать обратное разделу нельзя. */}
                <span className="text-sm text-slate-600">
                    В сборку служб идёт только Великий акафист — единственный, положенный
                    уставом. Остальные собраны ради корпуса и поиска.
                </span>
            </p>

            <Filters facets={data.facets} params={params} />

            <p className="font-serif text-sm text-slate-500 mt-4 mb-2">
                {data.total
                    ? `Акафистов: ${data.total}`
                    : "Ничего не нашлось. Попробуйте другое имя или снимите фильтры."}
            </p>

            <div className="flex flex-col gap-3">
                {data.items.map(a => (
                    <div key={a.id} className="flex flex-col">
                        <Link href={`/akathists/${a.id}`} className="font-serif text-red-900">
                            {a.title}
                        </Link>
                        <div className="text-xs text-slate-500 font-serif">
                            {[
                                labelOf(SUBJECT_KIND_LABELS, a.subjectKind),
                                labelOf(AKATHIST_STATUS_LABELS, a.status),
                                a.stanzas ? `строф ${a.stanzas}` : null,
                                // Проимиев бывает не один: греческие редакции носят
                                // два и больше. Показываем число только когда их
                                // правда несколько — иначе строка ни о чём.
                                a.prooimia > 1 ? `проимиев ${a.prooimia}` : null,
                                a.memory || null,
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
