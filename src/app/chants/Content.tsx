import React from "react";
import type { ChantHit } from "@/lib/chants";
import type { ChantsPageData } from "./api";
import { PAGE_SIZE } from "./api";
import Filters from "./Filters";
import {
    BOOK_LABELS, MARKER_LABELS, PLACEMENT_LABELS, SERVICE_LABELS,
    SIGN_LABELS, UNIT_LABELS, dayOfMonth, labelOf, shortPosition, stanzaLabel,
} from "@/utils/chantLabels";

/**
 * Фрагмент найденного. Кусок с hit подсвечивается — но подсветку рисуем сами
 * из размеченных кусков, а не вставляем разметку из строки: текст приходит из
 * корпуса, и вставлять его как HTML незачем ни при каких обстоятельствах.
 */
const Snippet = ({ parts }: { parts: ChantHit["snippet"] }) => (
    <p className="font-serif text-slate-800">
        {parts.map((part, i) =>
            part.hit
                ? <mark key={i} className="bg-amber-200 text-inherit">{part.text}</mark>
                : <React.Fragment key={i}>{part.text}</React.Fragment>,
        )}
    </p>
);

/**
 * Откуда это песнопение: книга, число месяцеслова, служба, место, глас, знак.
 *
 * У строфы акафиста ничего этого нет — он не день книги и не место службы, —
 * и подпись у неё своя: имя произведения и номер строфы. Без отдельной ветки
 * здесь оставалась бы пустая строка: полей много, а заполнено ни одно.
 */
const Origin = ({ hit }: { hit: ChantHit }) => {
    const parts = hit.akathist
        ? [hit.akathist, stanzaLabel(hit.unit, hit.stanza, hit.stanzaKind) || null]
            .filter(Boolean)
        : [
            labelOf(BOOK_LABELS, hit.book),
            dayOfMonth(hit.day, hit.month) || null,
            labelOf(SERVICE_LABELS, hit.service),
            shortPosition(hit.position) || null,
            hit.tone ? `глас ${hit.tone}` : null,
            hit.ode ? `песнь ${hit.ode}` : null,
        ].filter(Boolean);

    return (
        // Полная подпись места — в title: сокращаем показ, а не сведения.
        <div className="text-xs text-slate-500 font-serif" title={hit.position || undefined}>
            {parts.join(" · ")}
        </div>
    );
};

const Badges = ({ hit }: { hit: ChantHit }) => {
    const badges: string[] = [];
    if (hit.unit) badges.push(labelOf(UNIT_LABELS, hit.unit));
    if (hit.placement) badges.push(labelOf(PLACEMENT_LABELS, hit.placement));
    if (hit.marker) badges.push(labelOf(MARKER_LABELS, hit.marker));
    if (hit.sign) badges.push(labelOf(SIGN_LABELS, hit.sign));

    return (
        <div className="flex flex-wrap gap-1">
            {badges.map(b => (
                <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-serif">
                    {b}
                </span>
            ))}
        </div>
    );
};

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
                        {data.items.map(hit => (
                            <div key={hit.id} className="border-l-2 border-slate-200 pl-3">
                                <Origin hit={hit} />
                                <div className="font-serif text-sm text-slate-700 mb-1">{hit.memory}</div>
                                <Snippet parts={hit.snippet} />
                                <Badges hit={hit} />
                            </div>
                        ))}
                    </div>
                    <Pager page={page} total={data.total} params={params} />
                </>
            )}
        </div>
    );
};

export default Content;
