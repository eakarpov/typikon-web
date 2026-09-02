import React from "react";
import type { ChantsPageData } from "./api";
import { PAGE_SIZE } from "./api";
import Filters from "./Filters";
import { ChantCard } from "./ChantCard";

const Pager = ({ page, total, params }: { page: number; total: number; params: Record<string, string | undefined> }) => {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) return null;

    const href = (to: number) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v && k !== "page") next.set(k, v);
        next.set("page", String(to));
        return `/chants?${next.toString()}`;
    };

    return (
        <div className="flex gap-4 items-baseline font-serif mt-4">
            {page > 1 && <a href={href(page - 1)} className="text-red-900">← назад</a>}
            <span className="text-sm text-slate-500">страница {page} из {pages}</span>
            {page < pages && <a href={href(page + 1)} className="text-red-900">вперёд →</a>}
        </div>
    );
};

const Content = ({ data, params }: { data: ChantsPageData; params: Record<string, string | undefined> }) => {
    const page = Math.max(1, Number(params.page) || 1);
    const query = (params.q || "").trim();

    if (data.error === "corpus-missing") {
        return (
            <p className="font-serif text-slate-600">
                Корпус певческих текстов на этом сервере пока не выложен.
            </p>
        );
    }

    return (
        <div>
            <p className="font-serif mb-3">
                Поиск по песнопениям Октоиха, Миней, Триодей и Ирмология — каждое на своём
                месте службы.<br />
                Ударения и церковнославянское написание набирать не нужно: «услыши» находит
                «услы́ши», «ᲂу҆слы́ши» — тоже.
            </p>

            <Filters facets={data.facets} params={params} />

            {data.error === "too-short" && (
                <p className="font-serif text-slate-600 mt-4">
                    Запрос короче трёх букв — под него подошёл бы почти весь корпус.
                </p>
            )}

            {!data.error && query && (
                <>
                    <p className="font-serif text-sm text-slate-500 mt-4 mb-2">
                        {data.total
                            ? `Нашлось: ${data.total}`
                            : "Ничего не нашлось. Попробуйте другое слово или снимите фильтры."}
                    </p>
                    <div className="flex flex-col gap-4">
                        {data.items.map(hit => <ChantCard key={hit.id} hit={hit} />)}
                    </div>
                    <Pager page={page} total={data.total} params={params} />
                </>
            )}
        </div>
    );
};

export default Content;
