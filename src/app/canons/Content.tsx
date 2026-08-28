import React from "react";
import Link from "next/link";
import type { CanonRow } from "@/lib/canons";
import type { CanonsPageData } from "./api";
import { PAGE_SIZE } from "./api";
import Filters from "./Filters";
import {
    BOOK_LABELS, CANON_ROLE_LABELS, SERVICE_LABELS, labelOf, memoryAddress,
} from "@/utils/chantLabels";

/** Откуда канон: книга, координата памяти в ней, служба, глас, роль. */
const Origin = ({ canon }: { canon: CanonRow }) => {
    const parts = [
        labelOf(BOOK_LABELS, canon.book),
        memoryAddress(canon) || null,
        labelOf(SERVICE_LABELS, canon.service),
        canon.tone ? `глас ${canon.tone}` : null,
        canon.role ? labelOf(CANON_ROLE_LABELS, canon.role) : null,
    ].filter(Boolean);
    return <div className="text-xs text-slate-500 font-serif">{parts.join(" · ")}</div>;
};

const Pager = ({ page, total, params }: {
    page: number; total: number; params: Record<string, string | undefined>;
}) => {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) return null;
    const href = (to: number) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v && k !== "page") next.set(k, v);
        next.set("page", String(to));
        return `/canons?${next.toString()}`;
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
    data: CanonsPageData; params: Record<string, string | undefined>;
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
                Каноны Октоиха, Миней, Триодей и Минеи общей — каждый целиком, со всеми
                песнями.<br />
                <span className="text-sm text-slate-600">
                    Ищется по тому, кому канон и чьё он творение. Имена — как их пишет
                    книга, в родительном падеже: «Никола́я», а не «Николаю»; ударения
                    набирать не нужно, и части слова довольно — «Никола» найдёт всех.
                </span>
            </p>

            <Filters facets={data.facets} params={params} />

            <p className="font-serif text-sm text-slate-500 mt-4 mb-2">
                {data.total
                    ? `Канонов: ${data.total}`
                    : "Ничего не нашлось. Попробуйте другое имя или снимите фильтры."}
            </p>

            <div className="flex flex-col gap-3">
                {data.items.map(canon => (
                    <div key={canon.id} className="flex flex-col">
                        <Link href={`/canons/${canon.id}`} className="font-serif text-red-900">
                            {canon.memory || "Без метки памяти"}
                        </Link>
                        <Origin canon={canon} />
                        <div className="text-xs text-slate-500 font-serif">
                            {/* Песней у канона бывает и меньше восьми: трипеснцы и
                                двупеснцы Триоди — не обрывки, а свой род канона,
                                поэтому число песней стоит рядом всегда. */}
                            {canon.odes ? `песней ${canon.odes}` : "песней нет"}
                            {canon.creator ? ` · ${canon.creator}` : ""}
                            {canon.acrostic ? ` · краегранесие: ${canon.acrostic}` : ""}
                        </div>
                    </div>
                ))}
            </div>

            <Pager page={page} total={data.total} params={params} />
        </div>
    );
};

export default Content;
