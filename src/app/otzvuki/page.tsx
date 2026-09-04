import type { Metadata } from "next";
import Link from "next/link";
import { myFont } from "@/utils/font";
import { bibleBook } from "@/utils/bibleBooks";
import { BIBLE_SECTIONS, type BibleSection } from "@/utils/bibleCanon";
import { plural } from "@/utils/plural";
import { coveragePercent, type BookStats } from "@/lib/otzvuki/core";
import { cached, CacheTag } from "@/lib/cache";
import { citationBooks, citationSummary, citationTop, corpusStamp, stampMatches } from "@/lib/otzvuki/store";
import { TopVerses } from "@/app/otzvuki/TopVerses";

// Свод: чем богослужение читает Писание.
//
// Страница стиха («где ещё это звучит») отвечает про один стих. Здесь — про
// Писание целиком, и главный ответ не в том, что звучит, а в том, что не
// звучит вовсе: из 36 961 стиха канона службы уверенно касаются пятой части.
//
// СЧЁТ ВЕДУТ УВЕРЕННЫЕ ЦИТАТЫ. С короткими совпадениями затронутых стихов
// вышло бы 27 318 из 36 961 — три четверти Писания, — но три слова подряд в
// богослужебном языке чаще общее место, чем заимствование, и таким числом
// нельзя ничего утверждать. Оно названо, но не ведёт счёт.
//
// Данные приезжают готовыми из Монги (свод считает npm run citations:stats):
// группировка полумиллиона цитат — пять с лишним секунд, и в рендере ей не
// место. Оттого страница ничего не считает и почти ничего не решает.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Отзвуки Писания — Уставные чтения",
    description:
        "Чем богослужение читает Писание: какие книги и стихи звучат в песнопениях " +
        "и чтениях церковного года, а какие места не звучат вовсе.",
};

// Кэшируем здесь, а не в выборке: `unstable_cache` работает только внутри
// запроса, а те же выборки читает и панель здоровья, и прогон снимков.
const summaryOf = cached(citationSummary, ["otzvuki-summary"], [CacheTag.CITATIONS]);
const booksOf = cached(citationBooks, ["otzvuki-books"], [CacheTag.CITATIONS]);
const topOf = cached(citationTop, ["otzvuki-top"], [CacheTag.CITATIONS]);

const n = (value: number) => value.toLocaleString("ru-RU");

// Число ведёт слово за собой, и падеж у слова разный: «27 322 стиха» после
// счёта, но «из 36 961 стиха» и «из 27 322 стихов» после предлога. Одной
// формой это не покрыть, поэтому их две — и обе рядом, чтобы не разошлись.
const verses = (value: number) => `${n(value)} ${plural(value, "стих", "стиха", "стихов")}`;
const versesOf = (value: number) => `${n(value)} ${plural(value, "стиха", "стихов", "стихов")}`;

/** Доля с запятой, как принято в русском письме, и без хвоста у целых. */
const percent = (value: number) => `${value.toLocaleString("ru-RU")}%`;

const bookName = (canonId: string) => bibleBook(canonId)?.name ?? canonId;

/** Порядок книг: канонический по умолчанию, иначе по названному числу. */
const SORTS: Record<string, { label: string; pick?: (b: BookStats) => number }> = {
    canon: { label: "по порядку канона" },
    coverage: { label: "по охвату", pick: (b) => coveragePercent(b.verses.any, b.referenceVerses) ?? -1 },
    sung: { label: "по числу поемых стихов", pick: (b) => b.verses.sung },
    read: { label: "по числу читаемых стихов", pick: (b) => b.verses.read },
};

const Row = ({ book }: { book: BookStats }) => {
    const coverage = coveragePercent(book.verses.any, book.referenceVerses);
    return (
        <tr className="border-b border-slate-100">
            <td className="py-1 pr-3">
                <Link href={`/otzvuki/${book.canonId}`} className="text-red-900 hover:underline">
                    {bookName(book.canonId)}
                </Link>
            </td>
            <td className="py-1 pr-3 text-right text-slate-500">
                {book.referenceVerses ? n(book.referenceVerses) : "—"}
            </td>
            <td className="py-1 pr-3 text-right">{n(book.verses.sung)}</td>
            <td className="py-1 pr-3 text-right">{n(book.verses.read)}</td>
            <td className="py-1 pr-3 text-right">
                {coverage === null ? <span className="text-slate-400">—</span> : percent(coverage)}
            </td>
            <td className="py-1 pr-3 text-right text-slate-500">{n(book.citations.certain)}</td>
            <td className="py-1 text-right text-slate-500">{n(book.chants)}</td>
        </tr>
    );
};

const Head = () => (
    <thead>
        <tr className="text-xs text-slate-500 border-b border-slate-300">
            <th className="font-normal text-left py-1 pr-3">книга</th>
            <th className="font-normal text-right py-1 pr-3">стихов</th>
            <th className="font-normal text-right py-1 pr-3">поётся</th>
            <th className="font-normal text-right py-1 pr-3">читается</th>
            <th className="font-normal text-right py-1 pr-3">охват</th>
            <th className="font-normal text-right py-1 pr-3">цитат</th>
            <th className="font-normal text-right py-1">строк</th>
        </tr>
    </thead>
);

const Otzvuki = async ({ searchParams }: { searchParams: { sort?: string } }) => {
    const [summary, books, top] = await Promise.all([
        summaryOf(),
        booksOf(),
        topOf(),
    ]);

    if (!summary || !books.length) {
        return (
            <div className={`${myFont.variable} pt-2`}>
                <h1 className="font-bold font-serif">Отзвуки Писания</h1>
                <p className="font-serif text-slate-600 mt-2">
                    Свод ещё не посчитан на этом сервере. Считает его отдельный
                    прогон по корпусу — <code className="text-sm">npm run citations:stats -- --write</code>,
                    — а до тех пор показывать нечего: выдумывать числа здесь не из чего.
                </p>
                <p className="font-serif text-slate-600 mt-2">
                    Отзвуки отдельного стиха доступны и без свода — например,{" "}
                    <Link href="/bible/psaltir/117/22" className="text-red-900 hover:underline">
                        Пс. 117:22
                    </Link>.
                </p>
            </div>
        );
    }

    const sortKey = searchParams.sort && SORTS[searchParams.sort] ? searchParams.sort : "canon";
    const sort = SORTS[sortKey];
    // Монга отдаёт книги в порядке записи; Библию читают в своём. Порядок
    // канона восстанавливаем здесь, а не запросом: поле `order` для того в
    // документе и лежит.
    const inCanon = books
        .filter((b) => b.inCanon)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const outside = books
        .filter((b) => !b.inCanon)
        .sort((a, b) => b.citations.certain - a.citations.certain);

    const sorted = sort.pick
        ? [...inCanon].sort((a, b) => sort.pick!(b) - sort.pick!(a))
        : inCanon;

    // Свод посчитан по корпусу; корпус с тех пор мог приехать новый. Сравнить
    // стоит три мгновенных `max()`, а сказать об этом — дешевле, чем показать
    // числа, которые описывают вчерашнюю сборку, как будто они сегодняшние.
    const stale = !stampMatches(summary.stamp, corpusStamp());

    const silent = summary.canonVerses - summary.verses.any;

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-5`}>
            <div>
                <h1 className="font-bold font-serif">Отзвуки Писания</h1>
                <p className="font-serif text-slate-800 mt-2">
                    Богослужебный текст соткан из Писания, и это приём, а не случайность.
                    Из {versesOf(summary.canonVerses)} канона службы уверенно касаются{" "}
                    <strong>{n(summary.verses.any)}</strong> — {n(summary.verses.sung)} звучат
                    внутри песнопений, {n(summary.verses.read)} читаются вслух как чтения.
                    Остальные {n(silent)} не звучат ни так, ни так.
                </p>
                <p className="font-serif text-slate-600 text-sm mt-2">
                    {/* Разделение — главное, что говорит эта страница: без него книга,
                        которую только читают, и книга, которую поют, выглядят одинаково. */}
                    <strong>Поётся и читается — разные вещи.</strong> Паремия, Апостол,
                    Евангелие и прокимен Писанием и являются: их совпадение с источником —
                    не цитата, а тождество. Поэтому у стиха здесь два счёта, и Бытие
                    (читается много, поётся мало) не притворяется Псалтирью.
                </p>
                <p className="font-serif text-slate-600 text-sm mt-2">
                    Считаны совпадения от пяти слов подряд. С короткими вышло бы{" "}
                    {verses(summary.verses.withCandidates)} — три четверти Писания, — но
                    богослужебный язык формулен, и три слова подряд чаще общее место, чем
                    заимствование. Поэтому счёт ведут уверенные.
                </p>
            </div>

            <div className="text-xs text-slate-500 font-serif flex gap-3 flex-wrap items-baseline">
                <span>порядок:</span>
                {Object.entries(SORTS).map(([key, value]) => (
                    key === sortKey
                        ? <span key={key} className="text-slate-800">{value.label}</span>
                        : <Link key={key} href={key === "canon" ? "/otzvuki" : `/otzvuki?sort=${key}`}
                                className="text-red-900 hover:underline">{value.label}</Link>
                ))}
            </div>

            <div className="overflow-x-auto">
                <table className="font-serif text-sm min-w-[36rem] w-full">
                    <Head />
                    {sort.pick
                        ? <tbody>{sorted.map((book) => <Row key={book.canonId} book={book} />)}</tbody>
                        : BIBLE_SECTIONS.map((section) => {
                            const own = inCanon.filter((b) => b.section === (section.id as BibleSection));
                            if (!own.length) return null;
                            return (
                                <tbody key={section.id}>
                                    <tr>
                                        <td colSpan={7} className="pt-4 pb-1 text-xs text-slate-500">
                                            {section.label}
                                        </td>
                                    </tr>
                                    {own.map((book) => <Row key={book.canonId} book={book} />)}
                                </tbody>
                            );
                        })}
                </table>
            </div>

            {outside.length > 0 && (
                <section>
                    <h2 className="font-serif font-bold text-sm">Вне канона</h2>
                    <p className="font-serif text-xs text-slate-500 mt-1">
                        {/* Песни библейские — самая живая строка этого списка: ими поётся
                            канон утрени, и в каноне книг они не значатся вовсе. */}
                        Адреса, которых закрытый список книг не держит: Песни библейские,
                        Даниил по переводу Семидесяти, книги приложения. Справочной разбивки
                        у них нет, поэтому и охвата — тоже: делить было бы не на что.
                    </p>
                    <div className="overflow-x-auto mt-2">
                        <table className="font-serif text-sm min-w-[36rem] w-full">
                            <Head />
                            <tbody>
                                {outside.map((book) => <Row key={book.canonId} book={book} />)}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {top && <TopVerses top={top} />}

            <p className="text-xs text-slate-400 font-serif">
                Свод посчитан {new Date(summary.generatedAt).toLocaleDateString("ru-RU")} по{" "}
                {n(summary.citations.certain)} уверенным цитатам в {n(summary.chants)} строках корпуса.
                {stale && (
                    <span className="text-amber-700">
                        {" "}Корпус с тех пор пересобран — числа описывают прежнюю сборку,
                        пока свод не пересчитан.
                    </span>
                )}
            </p>
        </div>
    );
};

export default Otzvuki;
