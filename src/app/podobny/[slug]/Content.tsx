import React from "react";
import Link from "next/link";
import { PAGE_SIZE, type PodobenPageData } from "./api";
import Filters from "./Filters";
import { ChantCard } from "@/app/chants/ChantCard";
import { bookLanguageLabel, needsChurchFont } from "@/utils/bookLanguages";
import { plural } from "@/utils/plural";

const fontFor = (language: string) => (needsChurchFont(language) ? "font-sans-serif" : "");

const Pager = ({ page, total, slug, params }: {
    page: number; total: number; slug: string; params: Record<string, string | undefined>;
}) => {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) return null;

    const href = (to: number) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v && k !== "page") next.set(k, v);
        next.set("page", String(to));
        return `/podobny/${slug}?${next.toString()}`;
    };

    return (
        <div className="flex gap-4 items-baseline font-serif mt-4">
            {page > 1 && <a href={href(page - 1)} className="text-red-900">← назад</a>}
            <span className="text-sm text-slate-500">страница {page} из {pages}</span>
            {page < pages && <a href={href(page + 1)} className="text-red-900">вперёд →</a>}
        </div>
    );
};

/** Как это напечатано — он же указатель опечаток книги. */
const Spellings = ({ data }: { data: PodobenPageData }) => {
    const unit = data.unit!;
    if (unit.spellings.length < 2) return null;

    return (
        <section>
            <h2 className="font-serif font-bold text-sm">
                Как это напечатано — {unit.spellings.length}{" "}
                {plural(unit.spellings.length, "написание", "написания", "написаний")}
            </h2>
            <p className="font-serif text-xs text-slate-500 mt-1">
                Все они сведены в один подобен: имя сличается без ударений и знаков, потому
                что «Гро́б Тво́й, Спа́се» и «Гроб Твой Спасе» — один напев, а не два.
            </p>
            <ul className="mt-2 flex flex-col gap-0.5">
                {unit.spellings.map((spelling) => (
                    <li key={`${spelling.language}|${spelling.printed}`} className="font-serif text-sm">
                        <span className={fontFor(spelling.language)}>«{spelling.printed}»</span>
                        <span className="text-xs text-slate-500">
                            {" "}{bookLanguageLabel(spelling.language)} · {spelling.items}
                        </span>
                        {spelling.artefact && (
                            <span className="text-xs text-amber-700">
                                {" "}— не имя: так издание помечает сам образец («поётся своим напевом»)
                            </span>
                        )}
                        {spelling.mixedScript && (
                            <span className="text-xs text-amber-700">
                                {" "}— набрано в двух алфавитах: латинская буква внутри
                                кириллического слова, опечатка набора
                            </span>
                        )}
                        {spelling.byName && !spelling.artefact && (
                            <span className="text-xs text-slate-400">
                                {" "}— сведено по имени: ключа издания книга здесь не поставила
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
};

/** Строки, начинающиеся теми же словами: образец и его ближайшая родня. */
const Model = ({ data }: { data: PodobenPageData }) => {
    if (!data.model.length) {
        return (
            <p className="font-serif text-sm text-slate-500">
                Строки, начинающейся этими словами, в корпусе не нашлось: книга подписывает
                этим подобном стихиры, а самого образца не печатает.
            </p>
        );
    }

    return (
        <section>
            <h2 className="font-serif font-bold text-sm">Начинается так же</h2>
            <p className="font-serif text-xs text-slate-500 mt-1">
                {/* Оговорка стоит перед списком, а не после: без неё первую строку
                    прочтут как «вот самоподобен», а это находка по зачину. */}
                Имя подобна — это зачин образцовой стихиры, и он ищется по указателю зачинов.
                Самоподобен корпус нигде не помечает, поэтому здесь и образец, и написанные
                на него подражания: что из них что, видно по уликам справа.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
                {data.model.map((candidate) => (
                    <li key={candidate.itemId} className="font-serif text-sm">
                        <Link href={`/chants/${candidate.itemId}`}
                              className={`text-red-900 hover:underline ${fontFor(candidate.language)}`}>
                            {candidate.text.replace(/\//g, " ").slice(0, 70) || candidate.incipit}
                        </Link>
                        <div className="text-xs text-slate-500">
                            {[candidate.memory, candidate.why.join("; ")].filter(Boolean).join(" · ")}
                            {" · "}
                            <Link href={`/incipits/${candidate.language}/${encodeURIComponent(candidate.incipit)}`}
                                  className="text-red-900 hover:underline">
                                зачин
                            </Link>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
};

const Content = ({ data, slug, params }: {
    data: PodobenPageData; slug: string; params: Record<string, string | undefined>;
}) => {
    const page = Math.max(1, Number(params.page) || 1);

    if (data.corpusMissing) {
        return (
            <p className="font-serif text-slate-600">
                Корпус певческих текстов на этом сервере пока не выложен.
            </p>
        );
    }

    const unit = data.unit;
    if (!unit) {
        return (
            <p className="font-serif text-slate-600">
                Такого подобна в корпусе нет.{" "}
                <Link href="/podobny" className="text-red-900 hover:underline">Ко всем подобнам →</Link>
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <div>
                <Link href="/podobny" className="text-xs text-red-900 font-serif hover:underline">
                    ← ко всем подобнам
                </Link>
                <h1 className={`font-bold font-serif mt-1 ${fontFor(unit.names[0]?.language ?? "cu_gr")}`}>
                    {unit.names[0]?.printed ?? slug}
                </h1>
                {unit.names.length > 1 && (
                    <p className="font-serif text-slate-600">
                        {unit.names.slice(1).map((name) => (
                            <span key={name.language} className={fontFor(name.language)}>
                                {name.printed}
                                <span className="text-xs text-slate-400">
                                    {" "}({bookLanguageLabel(name.language)})
                                </span>
                                {" "}
                            </span>
                        ))}
                    </p>
                )}
                <p className="font-serif text-sm text-slate-500 mt-1">
                    {[
                        unit.tone ? `глас ${unit.tone}` : "глас не назван",
                        `${unit.items} ${plural(unit.items, "стихира", "стихиры", "стихир")}`,
                        `${unit.groups} ${plural(unit.groups, "место", "места", "мест")} в книгах`,
                    ].join(" · ")}
                </p>
                {unit.toneOutliers.length > 0 && (
                    <p className="font-serif text-xs text-slate-400 mt-0.5">
                        {/* Разброс гласов — не шум: он показывает, где разбор устава
                            приписал подобну чужое место. Прятать его нечестно. */}
                        Отклонения по гласу:{" "}
                        {unit.toneOutliers.slice(0, 4)
                            .map((o) => `${o.tone ?? "не назван"} (${o.items})`).join(", ")}
                        {unit.toneOutliers.length > 4 && ` и ещё ${unit.toneOutliers.length - 4}`}
                    </p>
                )}
            </div>

            <Model data={data} />

            <section>
                <h2 className="font-serif font-bold text-sm">Напев</h2>
                {data.tune ? (
                    <p className="font-serif text-sm mt-1">
                        <Link href={`/tunes/${data.tune.tune.id}`} className="text-red-900 hover:underline">
                            {data.tune.tradition.title}
                        </Link>
                        <span className="text-slate-500"> — {data.tune.why}; ноты и раскладка по слогам на образце</span>
                    </p>
                ) : (
                    <p className="font-serif text-sm text-slate-500 mt-1">
                        {/* Так будет на 496 страницах из 497, и говорить об этом надо
                            прямо: пустой блок читается как поломка, а не как состояние
                            дела. */}
                        Напев на этот подобен не снят. Ноты снимаются с книг руками, и сегодня
                        в собрании их семь на весь корпус — что снято, видно в разделе{" "}
                        <Link href="/tunes" className="text-red-900 hover:underline">Напевы</Link>.
                    </p>
                )}
            </section>

            <Spellings data={data} />

            <section>
                <h2 className="font-serif font-bold text-sm">Что им поётся</h2>
                <div className="mt-2">
                    <Filters facets={data.facets} params={params} />
                </div>
                <p className="font-serif text-sm text-slate-500 mt-3 mb-2">
                    {data.total
                        ? `Строк: ${data.total}`
                        : "Под такой отбор ничего не подошло."}
                </p>
                <div className="flex flex-col gap-3">
                    {data.items.map((hit) => <ChantCard key={hit.id} hit={hit} />)}
                </div>
                <Pager page={page} total={data.total} slug={slug} params={params} />
            </section>
        </div>
    );
};

export default Content;
