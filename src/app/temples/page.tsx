import { Suspense } from "react";
import Link from "next/link";
import { Metadata } from "next";
import { setMeta } from "@/lib/meta";
import { myFont } from "@/utils/font";
import { getDedicationCounts, getTemples, TEMPLES_PER_PAGE } from "@/lib/temples";
import { temples as templesCount } from "@/utils/plural";

// Указатель храмов. Нужен не сам по себе: престол — параметр службы, и пока
// читателю негде назвать свой храм, «свята́го, его́же есть храм» остаётся
// пустым пазом в отпусте, тропаре по входе и каноне субботней утрени.

export const metadata: Metadata = {
    title: "Храмы и престолы",
    description:
        "Указатель храмов с престолами: кому посвящён храм, когда его престольный праздник " +
        "и какая память устава за ним стоит.",
    openGraph: {
        title: "Храмы и престолы",
        description: "Указатель храмов с престолами и престольными праздниками.",
        url: "//www.typikon.su/temples/",
    },
};

const hrefWith = (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) search.set(k, String(v));
    const s = search.toString();
    return s ? `/temples?${s}` : "/temples";
};

const TemplesList = async ({ page, query, dedication }: { page: number; query: string; dedication: string }) => {
    const { items, total } = await getTemples({ page, query, dedication });
    const pages = Math.max(1, Math.ceil(total / TEMPLES_PER_PAGE));

    if (!items.length) {
        return (
            <p className="font-serif text-slate-500">
                Ничего не нашлось. Искать можно и по месту — городу или селу, а не только по имени храма.
            </p>
        );
    }

    return (
        <>
            <p className="font-serif text-slate-500 mb-2">
                {templesCount(total)}
                {pages > 1 && `; страница ${page} из ${pages}`}
            </p>
            <ul className="flex flex-col gap-1">
                {items.map((t) => {
                    const main = t.prestoly?.[0];
                    return (
                        <li key={t.slug} className="font-serif">
                            <Link className="text-amber-800 hover:underline" href={`/temples/${t.slug}`}>
                                {t.name}
                            </Link>
                            <span className="text-sm text-slate-500">
                                {t.place && ` — ${t.place}`}
                                {t.year && `, ${t.year}`}
                                {main && `; престол: ${main.label}`}
                                {/* Разбор имени — догадка, и молчать об этом нельзя:
                                    приход поправит, но только если увидит. */}
                                {main?.status === "pending" && (main.confidence ?? 0) < 0.6 && " (престол под вопросом)"}
                            </span>
                        </li>
                    );
                })}
            </ul>
            {pages > 1 && (
                <div className="flex flex-row gap-4 mt-4 font-serif">
                    {page > 1 && (
                        <Link className="text-amber-800 hover:underline" href={hrefWith({ q: query, dedication, page: page - 1 })}>
                            ← Предыдущие
                        </Link>
                    )}
                    <span className="text-slate-500">Страница {page} из {pages}</span>
                    {page < pages && (
                        <Link className="text-amber-800 hover:underline" href={hrefWith({ q: query, dedication, page: page + 1 })}>
                            Следующие →
                        </Link>
                    )}
                </div>
            )}
        </>
    );
};

const Filters = async ({ dedication, query }: { dedication: string; query: string }) => {
    const counts = await getDedicationCounts();
    const top = counts.slice(0, 12);
    return (
        <div className="font-serif text-sm mb-4">
            <span className="text-slate-500">Частые престолы: </span>
            {top.map((d) => (
                <Link
                    key={d.slug}
                    href={hrefWith({ q: query, dedication: d.slug === dedication ? undefined : d.slug })}
                    className={`mr-2 hover:underline ${d.slug === dedication ? "text-red-900 font-bold" : "text-amber-800"}`}
                >
                    {d.short} <span className="text-slate-400">{d.count}</span>
                </Link>
            ))}
        </div>
    );
};

const Temples = ({ searchParams }: { searchParams?: { page?: string; q?: string; dedication?: string } }) => {
    setMeta();
    const page = Number(searchParams?.page) || 1;
    const query = (searchParams?.q ?? "").trim();
    const dedication = (searchParams?.dedication ?? "").trim();

    return (
        <div className="pt-2">
            <div className={myFont.variable}>
                <p className="font-serif">
                    Храмы и их престолы. Выберите свой — и он подставится в службу дня.
                </p>
                <p className="font-serif text-sm text-slate-500 mb-4">
                    Храмы — из{" "}
                    <Link className="text-amber-800" href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</Link>{" "}
                    (ODbL) и{" "}
                    <Link className="text-amber-800" href="https://www.wikidata.org" target="_blank" rel="noreferrer">Wikidata</Link>{" "}
                    (CC0), престолы выведены из названий и не выверены.
                </p>
                <p className="font-serif mb-4">
                    <Link className="text-amber-800 hover:underline" href={hrefWith({ q: query, dedication }).replace("/temples", "/temples/map")}>
                        Показать на карте
                    </Link>
                    <span className="text-slate-500 text-sm"> — отбор карта берёт тот же, что и указатель.</span>
                </p>
                <form action="/temples" method="get" className="mb-4 flex flex-row gap-2 items-center">
                    <input
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder="Имя храма или место"
                        aria-label="Поиск по храмам"
                        className="font-serif border border-slate-300 rounded px-2 py-1 w-full max-w-sm"
                    />
                    {!!dedication && <input type="hidden" name="dedication" value={dedication} />}
                    <button type="submit" className="font-serif text-amber-800 hover:underline">Искать</button>
                    {(!!query || !!dedication) && (
                        <Link className="font-serif text-slate-500 hover:underline" href="/temples">Сбросить</Link>
                    )}
                </form>
                <Suspense fallback={<div className="font-serif text-slate-400">Считаю престолы…</div>}>
                    <Filters dedication={dedication} query={query} />
                </Suspense>
                <Suspense key={`${query}:${dedication}:${page}`} fallback={<div>Loading...</div>}>
                    <TemplesList page={page} query={query} dedication={dedication} />
                </Suspense>
            </div>
        </div>
    );
};

export default Temples;
