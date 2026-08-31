import { Suspense } from "react";
import Link from "next/link";
import { Metadata } from "next";
import { setMeta } from "@/lib/meta";
import { myFont } from "@/utils/font";
import { getSaintRows, SAINTS_PER_PAGE } from "@/app/saints/api";
import { saintMatches, searchTerms } from "@/lib/saintSearch";
import { plural } from "@/utils/plural";

// Указатель святых. До сих пор страницы /saints/[id] существовали, но попасть на них
// можно было только из текста — списка не было нигде, и в карту сайта они не попадали.

export const metadata: Metadata = {
    title: "Святые в собрании",
    description: "Указатель святых, чьи памяти и упоминания встречаются в уставных чтениях собрания.",
    openGraph: {
        title: "Святые в собрании",
        description: "Указатель святых, чьи памяти и упоминания встречаются в уставных чтениях собрания.",
        url: "//www.typikon.su/saints/",
    },
};

// Адрес страницы указателя с сохранением набранного в поиске: уходя на вторую
// страницу выдачи, запрос терять нельзя.
const pageHref = (page: number, query: string) =>
    `/saints?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`;

const SaintsList = async ({ page, query }: { page: number; query: string }) => {
    const all = await getSaintRows();

    // Отбор идёт по всему указателю, а не по показанной странице: иначе поиск
    // находил бы только среди тех пятидесяти, что и так на виду.
    const terms = searchTerms(query);
    const rows = terms.length ? all.filter((row) => saintMatches(row, terms)) : all;

    const pages = Math.max(1, Math.ceil(rows.length / SAINTS_PER_PAGE));
    const current = Math.min(Math.max(page, 1), pages);
    const shown = rows.slice((current - 1) * SAINTS_PER_PAGE, current * SAINTS_PER_PAGE);

    if (terms.length && !rows.length) {
        return (
            <p className="font-serif text-slate-500">
                По запросу «{query}» ничего не нашлось. Искать можно и по другим именованиям —
                мирскому имени или прозванию.
            </p>
        );
    }

    return (
        <>
            <p className="font-serif text-slate-500 mb-2">
                {terms.length
                    ? `Нашлось ${rows.length} ${plural(rows.length, "память", "памяти", "памятей")} из ${all.length}.`
                    : `Всего ${rows.length} ${plural(rows.length, "память", "памяти", "памятей")}; по убыванию числа чтений.`}
            </p>
            <ul className="flex flex-col gap-1">
                {shown.map((item) => (
                    <li key={item.dneslovId} className="font-serif">
                        <Link className="text-amber-800 hover:underline" href={`/saints/${item.slug ?? item.dneslovId}`}>
                            {item.name ?? `Память №${item.dneslovId}`}
                        </Link>
                        <span className="text-sm text-slate-500">
                            {" — "}
                            {!!item.texts && `${item.texts} ${plural(item.texts, "чтение", "чтения", "чтений")}`}
                            {!!item.texts && !!item.mentions && ", "}
                            {!!item.mentions && `${item.mentions} ${plural(item.mentions, "упоминание", "упоминания", "упоминаний")}`}
                        </span>
                    </li>
                ))}
            </ul>
            {pages > 1 && (
                <div className="flex flex-row gap-4 mt-4 font-serif">
                    {current > 1 && (
                        <Link className="text-amber-800 hover:underline" href={pageHref(current - 1, query)}>
                            ← Предыдущие
                        </Link>
                    )}
                    <span className="text-slate-500">Страница {current} из {pages}</span>
                    {current < pages && (
                        <Link className="text-amber-800 hover:underline" href={pageHref(current + 1, query)}>
                            Следующие →
                        </Link>
                    )}
                </div>
            )}
        </>
    );
};

const Saints = ({ searchParams }: { searchParams?: { page?: string; q?: string } }) => {
    setMeta();
    const page = Number(searchParams?.page) || 1;
    const query = (searchParams?.q ?? "").trim();

    return (
        <div className="pt-2">
            <div className={myFont.variable}>
                <p className="font-serif">
                    Святые, чьи памяти и упоминания встречаются в чтениях собрания. На странице памяти
                    собраны написанные к ней тексты и те чтения, где о святом говорится в теле текста.
                </p>
                <p className="font-serif text-sm text-slate-500 mb-4">
                    Сведения о самих святых — со святцев <Link className="text-amber-800" href="https://dneslov.org" target="_blank" rel="noreferrer">dneslov.org</Link>.
                </p>
                {/*
                    Обычная форма с методом GET, без своего кода на клиенте: запрос
                    остаётся в адресе, страницу можно послать ссылкой и вернуться к ней
                    назад по истории. Поиск на восемь сотен строк того не стоит, чтобы
                    ради него тащить состояние в браузер.
                */}
                <form action="/saints" method="get" className="mb-4 flex flex-row gap-2 items-center">
                    <input
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder="Имя, прозвание, мирское имя"
                        aria-label="Поиск по святым"
                        className="font-serif border border-slate-300 rounded px-2 py-1 w-full max-w-sm"
                    />
                    <button type="submit" className="font-serif text-amber-800 hover:underline">
                        Искать
                    </button>
                    {!!query && (
                        <Link className="font-serif text-slate-500 hover:underline" href="/saints">
                            Сбросить
                        </Link>
                    )}
                </form>
                <Suspense key={`${query}:${page}`} fallback={<div>Loading...</div>}>
                    {/* @ts-expect-error Async Server Component */}
                    <SaintsList page={page} query={query} />
                </Suspense>
            </div>
        </div>
    );
};

export default Saints;
