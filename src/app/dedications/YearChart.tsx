// Волна почитания: сколько храмов этого посвящения строилось в каждом полувеке.
//
// РИСУЕТСЯ НА СЕРВЕРЕ, обычным SVG. Волна — картинка неподвижная: её
// разглядывают, а не крутят, и тащить ради неё в браузер библиотеку графиков
// незачем.
//
// ЧЕРТА КАНОНИЗАЦИИ — ради неё всё и затевалось. Столбцы сами по себе говорят
// лишь «строили тогда-то»; поставленная рядом дата прославления превращает их
// в ответ на вопрос «когда почитание разошлось» — у Серафима Саровского волна
// встаёт через год после 1903-го.

const WIDTH = 640;
const HEIGHT = 160;
const PADDING = { top: 8, right: 8, bottom: 22, left: 8 };

const YearChart = ({ decades, canonized }: {
    decades: { from: number; count: number }[];
    canonized?: number | null;
}) => {
    if (decades.length < 2) return null;

    const from = decades[0].from;
    const to = decades[decades.length - 1].from + 50;
    const max = Math.max(...decades.map((d) => d.count));
    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const xOf = (year: number) => PADDING.left + ((year - from) / (to - from)) * plotWidth;
    const barWidth = Math.max(1, (plotWidth / ((to - from) / 50)) - 2);

    return (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img"
             aria-label="Сколько храмов этого посвящения строилось в каждом полувеке">
            {decades.map((d) => {
                const height = Math.max(1, (d.count / max) * plotHeight);
                return (
                    <rect
                        key={d.from}
                        x={xOf(d.from)}
                        y={PADDING.top + plotHeight - height}
                        width={barWidth}
                        height={height}
                        fill="#92400e"
                        opacity={0.75}
                    >
                        <title>{`${d.from}–${d.from + 49}: ${d.count}`}</title>
                    </rect>
                );
            })}
            {!!canonized && canonized >= from && canonized <= to && (
                <>
                    <line
                        x1={xOf(canonized)} x2={xOf(canonized)}
                        y1={PADDING.top} y2={PADDING.top + plotHeight}
                        stroke="#991b1b" strokeWidth={1.5} strokeDasharray="4 3"
                    />
                    <text x={xOf(canonized) + 4} y={PADDING.top + 10} fontSize="10" fill="#991b1b">
                        прославление
                    </text>
                </>
            )}
            <line
                x1={PADDING.left} x2={WIDTH - PADDING.right}
                y1={PADDING.top + plotHeight} y2={PADDING.top + plotHeight}
                stroke="#cbd5e1"
            />
            {/* Деления по векам: без них крайние подписи говорят лишь о размахе,
                а не о том, куда попадает столбец. */}
            {/* Отсчёт ведём от ближайшего КРУГЛОГО века, а не от начала данных:
                данные начинаются с половины века, и шаг от них давал деления
                1850, 1950 — числа верные, но читаются они как случайные. */}
            {Array.from(
                { length: Math.floor((to - Math.ceil(from / 100) * 100) / 100) + 1 },
                (_, i) => Math.ceil(from / 100) * 100 + i * 100)
                .filter((tick) => tick > from && tick < to)
                .map((tick) => (
                    <g key={tick}>
                        <line
                            x1={xOf(tick)} x2={xOf(tick)}
                            y1={PADDING.top + plotHeight} y2={PADDING.top + plotHeight + 3}
                            stroke="#cbd5e1"
                        />
                        <text x={xOf(tick)} y={HEIGHT - 6} fontSize="10" fill="#94a3b8" textAnchor="middle">
                            {tick}
                        </text>
                    </g>
                ))}
            <text x={PADDING.left} y={HEIGHT - 6} fontSize="11" fill="#64748b">{from}</text>
            <text x={WIDTH - PADDING.right} y={HEIGHT - 6} fontSize="11" fill="#64748b" textAnchor="end">{to}</text>
        </svg>
    );
};

export default YearChart;
