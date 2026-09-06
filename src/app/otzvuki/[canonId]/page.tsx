import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { myFont } from "@/utils/font";
import { bibleBook } from "@/utils/bibleBooks";
import { referenceChapterLengths } from "@/utils/bibleVersification";
import { coveragePercent, type BookStats, type SilentRun } from "@/lib/otzvuki/core";
import { cached, CacheTag } from "@/lib/cache";
import { citationBook } from "@/lib/otzvuki/store";
import BookMap from "@/app/otzvuki/[canonId]/BookMap";

// Одна книга Писания глазами богослужения.
//
// Ради карты и молчащих отрезков страница и заведена. Свод по книгам говорит
// «Бытие затронуто на 35 %», и это ещё не знание: 35 % могут быть ровным слоем
// по всей книге, а могут — двумя густыми пятнами и молчанием на сорок глав.
// Разница видна только картой, и она же превращает число в наблюдение.

export const dynamic = "force-dynamic";

// Кэш — на странице, а не в выборке: см. @/lib/otzvuki/store.
const bookOf = cached(citationBook, ["otzvuki-book"], [CacheTag.CITATIONS]);

const n = (value: number) => value.toLocaleString("ru-RU");

/** Доля с запятой, как принято в русском письме. */
const percent = (value: number) => `${value.toLocaleString("ru-RU")}%`;

type Props = { params: { canonId: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const book = bibleBook(params.canonId);
    if (!book) return { title: "Книга не найдена — Уставные чтения" };
    return {
        title: `${book.name} в богослужении — Уставные чтения`,
        description: `Какие стихи книги «${book.name}» звучат в песнопениях и чтениях церковного года, а какие не звучат вовсе.`,
    };
}

const range = (run: SilentRun) =>
    run.fromChapter === run.toChapter
        ? `${run.fromChapter}:${run.fromVerse}–${run.toVerse}`
        : `${run.fromChapter}:${run.fromVerse} — ${run.toChapter}:${run.toVerse}`;

/** Самые звучащие стихи этой книги — считаются из её же карты. */
const topOf = (stats: BookStats, fact: "sung" | "read", limit = 8) =>
    stats.chapters
        .flatMap((chapter) => chapter.verses.map((verse) => ({
            chapter: chapter.chapter,
            verse: verse.v,
            count: fact === "sung" ? verse.sung : verse.read,
        })))
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count || a.chapter - b.chapter || a.verse - b.verse)
        .slice(0, limit);

const Legend = () => (
    <div className="flex flex-wrap gap-4 text-xs text-slate-500 font-serif items-center">
        <span className="flex items-center gap-1.5">
            <svg width="14" height="10" aria-hidden="true">
                <rect x="0" y="0" width="14" height="5" fill="#991b1b" />
                <rect x="0" y="5" width="14" height="5" fill="#f1f5f9" />
            </svg>
            поётся в песнопениях
        </span>
        <span className="flex items-center gap-1.5">
            <svg width="14" height="10" aria-hidden="true">
                <rect x="0" y="0" width="14" height="5" fill="#f1f5f9" />
                <rect x="0" y="5" width="14" height="5" fill="#475569" />
            </svg>
            читается вслух
        </span>
        <span className="flex items-center gap-1.5">
            <svg width="14" height="10" aria-hidden="true">
                <rect x="0" y="0" width="14" height="10" fill="#f1f5f9" />
            </svg>
            не звучит
        </span>
        <span>чем гуще цвет, тем чаще: один раз · до пяти · больше</span>
    </div>
);

const BookPage = async ({ params }: Props) => {
    const book = bibleBook(params.canonId);
    const stats = await bookOf(params.canonId);
    if (!book || !stats) notFound();

    const lengths = referenceChapterLengths(params.canonId);
    const coverage = coveragePercent(stats.verses.any, stats.referenceVerses);
    const silent = stats.referenceVerses ? stats.referenceVerses - stats.verses.any : null;
    const sung = topOf(stats, "sung");
    const read = topOf(stats, "read");

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-5`}>
            <div>
                <Link href="/otzvuki" className="text-xs text-red-900 font-serif hover:underline">
                    ← ко всему Писанию
                </Link>
                <h1 className="font-bold font-serif mt-1">{book.name} в богослужении</h1>
                <p className="font-serif text-slate-800 mt-2">
                    {stats.referenceVerses
                        ? <>
                            Из {n(stats.referenceVerses)} стихов книги службы касаются{" "}
                            <strong>{n(stats.verses.any)}</strong>
                            {coverage !== null && <> — {percent(coverage)}</>}: {n(stats.verses.sung)} звучат
                            в песнопениях, {n(stats.verses.read)} читаются вслух.
                            {silent !== null && <> Молчат {n(silent)}.</>}
                        </>
                        : <>
                            {/* Книга вне канона: знаменателя нет, и доля не считается. */}
                            Справочной разбивки у этого адреса нет, поэтому доли здесь не будет.
                            Известно, что затронуто {n(stats.verses.any)} стихов: {n(stats.verses.sung)}{" "}
                            в песнопениях, {n(stats.verses.read)} чтениями.
                        </>}
                </p>
                <p className="font-serif text-xs text-slate-500 mt-1">
                    {n(stats.citations.certain)} уверенных цитат в {n(stats.chants)} строках корпуса;
                    коротких совпадений, не считаемых цитатой, ещё {n(stats.citations.candidate)}.
                </p>
            </div>

            <section className="flex flex-col gap-2">
                <Legend />
                <BookMap
                    canonId={params.canonId}
                    abbr={book.abbr}
                    chapters={stats.chapters}
                    lengths={lengths}
                />
                <p className="text-xs text-slate-400 font-serif">
                    Строка — глава, клетка — стих; номер главы ведёт в текст, клетка — к списку
                    песнопений, где это место звучит.
                </p>
            </section>

            {stats.silent.length > 0 && (
                <section>
                    <h2 className="font-serif font-bold text-sm">Что не звучит</h2>
                    <p className="font-serif text-xs text-slate-500 mt-1">
                        Самые длинные отрезки подряд, которых богослужение не поёт и не читает.
                        Отрезки короче десяти стихов не показываем: пропуск в два-три стиха
                        посреди поемой главы говорит о пределе сличителя, а не о молчании книги.
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {stats.silent.map((run) => (
                            <li key={`${run.fromChapter}-${run.fromVerse}`} className="font-serif text-sm">
                                <Link
                                    href={`/bible/${params.canonId}/${run.fromChapter}`}
                                    className="text-red-900 hover:underline"
                                >
                                    {book.abbr} {range(run)}
                                </Link>
                                <span className="text-xs text-slate-500"> · {n(run.verses)}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {(sung.length > 0 || read.length > 0) && (
                <section className="flex flex-wrap gap-8">
                    {sung.length > 0 && (
                        <div className="flex-1 min-w-[14rem]">
                            <h2 className="font-serif font-bold text-sm">Чаще всего поётся</h2>
                            <ul className="mt-2 flex flex-col gap-0.5">
                                {sung.map((row) => (
                                    <li key={`s${row.chapter}-${row.verse}`} className="font-serif text-sm">
                                        <Link
                                            href={`/bible/${params.canonId}/${row.chapter}/${row.verse}`}
                                            className="text-red-900 hover:underline"
                                        >
                                            {book.abbr} {row.chapter}:{row.verse}
                                        </Link>
                                        <span className="text-xs text-slate-500"> · {n(row.count)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {read.length > 0 && (
                        <div className="flex-1 min-w-[14rem]">
                            <h2 className="font-serif font-bold text-sm">Чаще всего читается</h2>
                            <ul className="mt-2 flex flex-col gap-0.5">
                                {read.map((row) => (
                                    <li key={`r${row.chapter}-${row.verse}`} className="font-serif text-sm">
                                        <Link
                                            href={`/bible/${params.canonId}/${row.chapter}/${row.verse}`}
                                            className="text-red-900 hover:underline"
                                        >
                                            {book.abbr} {row.chapter}:{row.verse}
                                        </Link>
                                        <span className="text-xs text-slate-500"> · {n(row.count)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
            )}

            <Link href={`/bible/${params.canonId}/1`} className="text-sm text-red-900 font-serif hover:underline">
                читать саму книгу →
            </Link>
        </div>
    );
};

export default BookPage;
