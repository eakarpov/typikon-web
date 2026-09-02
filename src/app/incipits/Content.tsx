import React from "react";
import Link from "next/link";
import type { IncipitsPageData } from "./api";
import { PAGE_SIZE } from "./api";
import Filters from "./Filters";
import { UNIT_LABELS, labelOf } from "@/utils/chantLabels";
import { bookLanguageShort } from "@/utils/bookLanguages";

const hrefWith = (params: Record<string, string | undefined>, changes: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") next.set(k, v);
    for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k); }
    return `/incipits?${next.toString()}`;
};

const Pager = ({ page, total, params }: {
    page: number; total: number; params: Record<string, string | undefined>;
}) => {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) return null;
    const href = (to: number) => hrefWith(params, { page: String(to) });
    return (
        <div className="flex gap-4 items-baseline font-serif mt-4">
            {page > 1 && <a href={href(page - 1)} className="text-red-900">← назад</a>}
            <span className="text-sm text-slate-500">страница {page} из {pages}</span>
            {page < pages && <a href={href(page + 1)} className="text-red-900">вперёд →</a>}
        </div>
    );
};

/**
 * Буквенный перечень — то, чем указатель встречает пришедшего без запроса.
 * Числа при буквах не показываем: посчитать их значит прочитать все ключи языка,
 * а сколько нашлось, видно сразу после нажатия.
 */
const Alphabet = ({ letters, params }: {
    letters: string[]; params: Record<string, string | undefined>;
}) => (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4">
        {letters.map(letter => (
            <a key={letter} href={hrefWith(params, { q: letter })}
               className="font-serif text-lg text-red-900">
                {letter}
            </a>
        ))}
    </div>
);

/** Строка выдачи: сам зачин ключом, под ним — как это напечатано в книге. */
const Row = ({ item }: { item: IncipitsPageData["items"][number] }) => {
    // Косая черта в корпусе — разрыв строки песнопения; в одну строку списка
    // она не нужна, но и склеивать слова нельзя.
    const printed = item.text.replace(/\s*\/\s*/g, " ").trim();
    const target = item.uses > 1
        ? `/incipits/${item.language}/${encodeURIComponent(item.incipit)}`
        : `/chants/${item.sampleId}`;

    return (
        <div className="flex flex-col">
            <Link href={target} className="font-serif text-red-900">{item.incipit}</Link>
            <p className="font-serif text-slate-700 text-sm">
                {printed.length > 140 ? `${printed.slice(0, 140)}…` : printed}
            </p>
            <div className="text-xs text-slate-500 font-serif">
                {[
                    labelOf(UNIT_LABELS, item.unit),
                    bookLanguageShort(item.language),
                    item.memory || item.akathist || null,
                    // Число вхождений — единственное, ради чего сюда стоит
                    // заходить: 91,6 % зачинов встречаются ровно один раз, и
                    // повтор сам по себе уже находка.
                    item.uses > 1 ? `вхождений: ${item.uses}` : null,
                ].filter(Boolean).join(" · ")}
            </div>
        </div>
    );
};

const Content = ({ data, params }: {
    data: IncipitsPageData; params: Record<string, string | undefined>;
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
                Указатель зачинов: песнопения книг по первым словам.<br />
                <span className="text-sm text-slate-600">
                    Зачин (инципит) — то, чем песнопение опознают и на что ссылаются: книги
                    и сами печатают его вместо полного текста, когда он уже был. Ударения и
                    церковнославянское написание набирать не нужно.
                </span>
            </p>

            <Filters facets={data.facets} params={params} />

            {data.alphabet ? (
                <>
                    <p className="font-serif text-sm text-slate-500 mt-4">
                        Начните с буквы или наберите первые слова.
                    </p>
                    <Alphabet letters={data.alphabet} params={params} />
                </>
            ) : (
                <>
                    <p className="font-serif text-sm text-slate-500 mt-4 mb-2">
                        {data.total
                            ? `Зачинов: ${data.total.toLocaleString("ru")}`
                            : "Ничего не нашлось. Указатель ищет по НАЧАЛУ песнопения — " +
                              "если слово стоит в середине, оно здесь не найдётся."}
                    </p>

                    {data.total === 0 && params.q && (
                        // Промах по указателю чаще всего значит не «такого текста нет», а
                        // «искали не начало». Поиску по всему тексту здесь самое место.
                        <p className="font-serif text-sm mb-2">
                            <Link href={`/chants?q=${encodeURIComponent(params.q)}`}
                                  className="text-red-900">
                                Искать «{params.q}» по всему тексту песнопений →
                            </Link>
                        </p>
                    )}

                    <div className="flex flex-col gap-3">
                        {data.items.map(item => (
                            <Row key={`${item.language}/${item.incipit}`} item={item} />
                        ))}
                    </div>

                    <Pager page={page} total={data.total} params={params} />
                </>
            )}
        </div>
    );
};

export default Content;
