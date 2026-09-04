import { densityStep, type ChapterMap } from "@/lib/otzvuki/core";

// Карта книги: строка на главу, клетка на стих.
//
// РИСУЕТСЯ НА СЕРВЕРЕ, обычным SVG — как волна почитания в /dedications.
// Картинка неподвижная: её разглядывают, а не крутят.
//
// ДВА ФАКТА В ОДНОЙ КЛЕТКЕ, а не двумя полосами: верхняя половина — поётся,
// нижняя — читается. Так «этот стих читают, но не поют» видно в самом глифе;
// двумя картинками рядом это пришлось бы сличать глазами, а разница между
// поемым и читаемым — ровно то, ради чего карта и нужна.
//
// СТРОКИ РВАНЫЕ: каждая своей длины. Подбей мы их под самую длинную,
// Псалтирь превратилась бы в лист, где 150 коротких глав жмутся к левому
// краю ради одного 118-го псалма в 176 стихов.
//
// РИСУЕМ РАЗРЕЖЕННО: фон главы — один прямоугольник, поверх него только
// клетки с ненулевым числом. У Псалтири полная сетка была бы 151 × 176 =
// 26 576 клеток при 2 532 существующих стихах и полутора тысячах звучащих.

const WIDTH = 640;
const LABEL = 28;
const ROW_H = 9;
const CELL_H = 7;
const TOP = 4;

// Тёплое против холодного, а не два оттенка красного. Первым решением были
// багрец и умбра — цвета остальных картинок проекта, — но на клетке в три
// пиксела они сливаются, и карта переставала отвечать на свой единственный
// вопрос: что здесь читают, а что поют. Синевато-серый — из той же палитры,
// которой набран весь приглушённый текст.
const SUNG = "#991b1b";
const READ = "#475569";
const OPACITY = [0, 0.3, 0.62, 1];

interface Props {
    canonId: string;
    abbr: string;
    chapters: ChapterMap[];
    /** Длины глав по справочной разбивке; null — книги в каноне нет. */
    lengths: number[] | null;
}

const BookMap = ({ canonId, abbr, chapters, lengths }: Props) => {
    const byChapter = new Map(chapters.map((c) => [c.chapter, c]));

    // Книга без справочной разбивки (Песни библейские, Даниил по LXX) рисуется
    // по тому, что нашлось: длина главы — последний известный стих. Это не
    // полная карта, и молчание на ней не читается — о чём сказано на странице.
    const rows: Array<{ chapter: number; length: number }> = lengths
        ? lengths.map((length, i) => ({ chapter: i + 1, length })).filter((r) => r.length > 0)
        : chapters.map((c) => ({
            chapter: c.chapter,
            length: c.verses.reduce((max, v) => Math.max(max, v.v), 0),
        }));

    if (!rows.length) return null;

    const maxVerses = Math.max(...rows.map((r) => r.length));
    const plotWidth = WIDTH - LABEL - 4;
    const cell = Math.max(1.4, Math.min(8, plotWidth / maxVerses));
    const height = TOP * 2 + rows.length * ROW_H;

    const label = `Карта книги ${abbr}: где богослужение поёт и читает её стихи`;

    return (
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full h-auto" role="img" aria-label={label}>
            {rows.map((row, i) => {
                const y = TOP + i * ROW_H;
                const found = byChapter.get(row.chapter);
                return (
                    <g key={row.chapter}>
                        <a href={`/bible/${canonId}/${row.chapter}`}>
                            <text x={LABEL - 4} y={y + CELL_H} fontSize="7" textAnchor="end" fill="#94a3b8">
                                {row.chapter}
                            </text>
                        </a>
                        <rect
                            x={LABEL} y={y} width={row.length * cell} height={CELL_H}
                            fill="#f1f5f9"
                        />
                        {found?.verses.map((verse) => {
                            const sung = densityStep(verse.sung);
                            const read = densityStep(verse.read);
                            if (!sung && !read) return null;
                            const x = LABEL + (verse.v - 1) * cell;
                            const title = `${abbr} ${row.chapter}:${verse.v} — `
                                + [
                                    verse.sung ? `в песнопениях ${verse.sung}` : "",
                                    verse.read ? `чтениями ${verse.read}` : "",
                                ].filter(Boolean).join(", ");
                            return (
                                <a key={verse.v} href={`/bible/${canonId}/${row.chapter}/${verse.v}`}>
                                    <title>{title}</title>
                                    {sung > 0 && (
                                        <rect
                                            x={x} y={y} width={Math.max(cell - 0.3, 1)} height={CELL_H / 2}
                                            fill={SUNG} opacity={OPACITY[sung]}
                                        />
                                    )}
                                    {read > 0 && (
                                        <rect
                                            x={x} y={y + CELL_H / 2} width={Math.max(cell - 0.3, 1)} height={CELL_H / 2}
                                            fill={READ} opacity={OPACITY[read]}
                                        />
                                    )}
                                </a>
                            );
                        })}
                    </g>
                );
            })}
        </svg>
    );
};

export default BookMap;
