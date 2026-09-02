import Link from "next/link";
import { csFont } from "@/utils/font";
import { needsChurchFont } from "@/utils/bookLanguages";
import type { ChapterData, EditionView } from "@/app/bible/api";
import EditionPicker from "@/app/bible/EditionPicker";

// Церковнославянское и валашское начертания обычным шрифтом не показать — в нём нет
// ни титла, ни юса, и текст осыплется квадратами. Решает язык издания, а не догадка
// по содержимому.
const fontOf = (edition: EditionView) =>
    needsChurchFont(edition.language)
        ? { wrapper: csFont.variable, text: "font-sans-serif" }
        : { wrapper: "", text: "font-serif" };

const chapterHref = (canonId: string, chapter: number, codes: string, base: string | null) =>
    `/bible/${canonId}/${chapter}?v=${codes}${base ? `&base=${base}` : ""}`;

// Стих, которого в самом издании нет. Показывается приглушённо и с крестиком:
// молча пропустить его нельзя (читатель сочтёт это нашей недоработкой), но и
// выдавать за напечатанное — тоже. Что именно не так, сказано под текстом.
const ABSENT_MARK = "†";

const AbsentNote = ({
    absent,
    number,
}: {
    absent: { supplied: string; why: string };
    number: string;
}) => (
    <p className="font-serif text-sm text-slate-500 mt-2">
        {ABSENT_MARK} {number} — этого стиха в издании нет: {absent.why} Здесь он показан
        по традиции, {absent.supplied}.
    </p>
);

/** Одно издание — сплошным текстом, как читают книгу. */
const SingleColumn = ({ data, edition }: { data: ChapterData; edition: EditionView }) => {
    const font = fontOf(edition);

    const absent = data.rows
        .map((row) => (row.cells[0]?.absent ? { row, absent: row.cells[0]!.absent! } : null))
        .filter(Boolean) as Array<{ row: typeof data.rows[0]; absent: { supplied: string; why: string } }>;

    return (
        <>
            <p className={`${font.wrapper} ${font.text} text-justify text-lg whitespace-pre-wrap`}>
                {data.rows.map((row) => {
                    const cell = row.cells[0];
                    if (!cell) return null;
                    return (
                        <span key={row.canonRef} id={`v${row.number}`}>
                            <sup className="text-red-600 font-bold">{row.number}</sup>{" "}
                            {cell.absent ? (
                                <span className="text-slate-500">
                                    {cell.content}
                                    <sup className="text-slate-500">{ABSENT_MARK}</sup>
                                </span>
                            ) : cell.content}{" "}
                        </span>
                    );
                })}
            </p>
            {absent.map(({ row, absent: mark }) => (
                <AbsentNote
                    key={row.canonRef}
                    absent={mark}
                    number={`${data.chapter}:${row.number}`}
                />
            ))}
        </>
    );
};

/**
 * Несколько изданий — таблицей, строка на стих канона.
 *
 * Пустая ячейка означает, что у издания такого стиха нет: у румынской Псалтири в
 * девятом псалме на стих меньше, чем у славянской. Показываем пробел, а не сдвигаем
 * соседние строки — иначе весь псалом ниже поехал бы на строку, и разъехавшуюся
 * параллель заметил бы только тот, кто читает оба столбца сразу.
 *
 * Родной номер стиха подписан там, где он расходится с каноническим: по нему стих
 * ищут в бумажной книге, и молча показывать один номер вместо другого нельзя.
 */
const ParallelColumns = ({ data }: { data: ChapterData }) => {
    const notes = data.rows.flatMap((row) => row.cells
        .map((cell, index) => (cell?.absent
            ? { key: `${row.canonRef}:${index}`, edition: data.editions[index], number: row.number, absent: cell.absent }
            : null))
        .filter(Boolean) as Array<{ key: string; edition: EditionView; number: number; absent: { supplied: string; why: string } }>);

    return (
    <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
            <thead>
                <tr>
                    <th className="w-8" />
                    {data.editions.map((edition) => (
                        <th
                            key={edition.code}
                            className="font-serif text-sm text-red-900 text-left align-bottom pb-1 px-2"
                        >
                            {edition.shortTitle}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.rows.map((row) => (
                    <tr key={row.canonRef} id={`v${row.number}`} className="align-top">
                        <td className="text-red-600 font-bold font-serif text-sm pt-1">
                            {row.number}
                        </td>
                        {row.cells.map((cell, index) => {
                            const edition = data.editions[index];
                            const font = fontOf(edition);
                            if (!cell) {
                                return (
                                    <td key={edition.code} className="px-2 py-1 text-slate-300 font-serif">
                                        —
                                    </td>
                                );
                            }
                            const shifted = cell.chapter !== data.chapter || cell.verse !== row.number;
                            return (
                                <td
                                    key={edition.code}
                                    className={`px-2 py-1 text-justify ${font.wrapper} ${font.text}`}
                                >
                                    {shifted && (
                                        <span
                                            className="text-slate-400 text-xs font-serif mr-1"
                                            title="Как этот стих пронумерован в самом издании"
                                        >
                                            [{cell.chapter}:{cell.verse}]
                                        </span>
                                    )}
                                    {cell.absent ? (
                                        <span className="text-slate-500">
                                            {cell.content}
                                            <sup className="text-slate-500">{ABSENT_MARK}</sup>
                                        </span>
                                    ) : cell.content}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
        {notes.map((note) => (
            <AbsentNote
                key={note.key}
                absent={note.absent}
                number={`${note.edition.shortTitle}, ${data.chapter}:${note.number}`}
            />
        ))}
    </div>
    );
};

const Chapter = ({
    data,
    codes,
    allEditions,
    previous,
    next,
}: {
    data: ChapterData;
    codes: string;
    /** Все публичные издания — чтобы снятое можно было вернуть, не правя адрес. */
    allEditions: EditionView[];
    previous: { canonId: string; chapter: number; label: string } | null;
    next: { canonId: string; chapter: number; label: string } | null;
}) => (
    <div className="pt-2 space-y-3">
        <div className="font-serif text-sm">
            <Link href="/bible" className="text-red-900">← к Библии</Link>
        </div>

        <h1 className="font-bold font-serif text-xl">
            {data.name}, глава {data.chapter}
            {data.base && (
                <span className="text-slate-400 font-normal text-base">
                    {" "}— по счёту издания «{data.editions[0].shortTitle}»
                </span>
            )}
        </h1>

        <EditionPicker
            editions={allEditions}
            selected={codes.split(",").filter(Boolean)}
            base={data.base}
        />

        {data.chapters.length > 1 && (
            <p className="font-serif text-sm space-x-1">
                {data.chapters.map((chapter) => (
                    <Link
                        key={chapter}
                        href={chapterHref(data.canonId, chapter, codes, data.base)}
                        className={chapter === data.chapter ? "font-bold text-red-900" : "text-slate-500 hover:text-red-900"}
                    >
                        {chapter}
                    </Link>
                ))}
            </p>
        )}

        {!data.rows.length ? (
            <p className="font-serif text-slate-500">
                В выбранных изданиях этой главы нет.
            </p>
        ) : data.editions.length === 1 ? (
            <SingleColumn data={data} edition={data.editions[0]} />
        ) : (
            <ParallelColumns data={data} />
        )}

        <div className="flex justify-between font-serif text-sm pt-2">
            <span>
                {previous && (
                    <Link href={chapterHref(previous.canonId, previous.chapter, codes, data.base)} className="text-red-900">
                        ← {previous.label}
                    </Link>
                )}
            </span>
            <span>
                {next && (
                    <Link href={chapterHref(next.canonId, next.chapter, codes, data.base)} className="text-red-900">
                        {next.label} →
                    </Link>
                )}
            </span>
        </div>
    </div>
);

export default Chapter;
