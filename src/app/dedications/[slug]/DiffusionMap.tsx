'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import { Point } from "ol/geom";
import { fromLonLat } from "ol/proj";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import "ol/ol.css";
import { quantile, shiftOf, spreadOf } from "@/lib/geoSpread";
import { temples as templesCount } from "@/utils/plural";

// КАК РАСХОДИЛОСЬ ПОЧИТАНИЕ. Та же география, но с осью времени: на каждом
// шаге видно всё, что построено ДО этого года, и отдельно — что прибавилось в
// текущий полувек. Кромка ареала при этом движется, и движение это и есть
// ответ на вопрос «как расходилось», которого неподвижная карта не даёт.
//
// ПОЧЕМУ ОТДЕЛЬНАЯ КАРТА, А НЕ ПОЛЗУНОК В СОСЕДНЕЙ. Та показывает ВСЕ храмы
// посвящения, сводя их в гнёзда на сервере; здесь показываются только
// датированные — шестая часть каталога. Один ползунок в общей карте молча
// убрал бы с неё пять храмов из шести, и читатель принял бы остаток за целое.
// Общего у двух карт — подложка и десяток строк заведения; мера ареала не
// скопирована, а вынесена в @/lib/geoSpread и считается одним кодом с разделом
// выше.
//
// ТОЧКИ ПРИВОЗЯТСЯ РАЗОМ. Датированных у самого крупного посвящения 838 — их
// дешевле привезти один раз, чем ходить на сервер за каждый полувек: иначе
// «проиграть» — это пятнадцать запросов на одно нажатие.

/** Шаг оси — полувек, тот же, каким сложена гистограмма «Когда строили». */
const STEP = 50;

/** Сколько держать один полувек при проигрывании. */
const FRAME_MS = 900;

interface Dot { x: number; y: number; year: number; s: string; n: string }

// Построенное в текущий полувек — ярко и крупно, прежнее — бледной подложкой.
// Без этого различия карта не показывает движения: точки просто накапливаются,
// и глазу не за что зацепиться.
const FRESH = new Style({
    image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: "rgba(146,64,14,0.95)" }),
        stroke: new Stroke({ color: "#fff", width: 1.5 }),
    }),
});

const EARLIER = new Style({
    image: new CircleStyle({
        radius: 3.5,
        fill: new Fill({ color: "rgba(146,64,14,0.3)" }),
    }),
});

const HIT_TOLERANCE = 8;

const DiffusionMap = ({ dedication, height = "h-[52vh]" }: { dedication: string; height?: string }) => {
    // Узел карты держим СОСТОЯНИЕМ, а не ссылкой. Пока точки едут, полотна на
    // странице нет вовсе (вместо него строка «собираю»), и эффект по ссылке
    // отработал бы на пустоте один раз — и больше никогда: карта не появлялась
    // бы вообще. Состояние же меняется ровно тогда, когда узел возник.
    const [node, setNode] = useState<HTMLDivElement | null>(null);
    const map = useRef<Map | null>(null);
    const source = useRef(new VectorSource());
    const layer = useRef<VectorLayer<VectorSource> | null>(null);
    // Рамка, по которой карту надо открыть, и признак того, что это уже сделано.
    // Врозь, потому что подгонять вид можно только у карты, знающей свой размер
    // (см. ниже, `fitWhenSized`).
    const box = useRef<[number, number, number, number] | null>(null);
    const fitted = useRef(false);
    // Текущий полувек держим ССЫЛКОЙ, потому что читает его стилевая функция
    // слоя, а не разметка: перекладывать стиль в каждую из восьми сотен точек
    // на каждый шаг — это восемь сотен оповещений об изменении на один щелчок
    // ползунка, и полсекунды на шаг. Со стилевой функцией оповещение одно.
    const visible = useRef({ from: 0, upTo: 0 });
    const [dots, setDots] = useState<Dot[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [step, setStep] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [picked, setPicked] = useState<Dot | null>(null);

    // ── Точки ────────────────────────────────────────────────────────────────
    useEffect(() => {
        let alive = true;
        fetch(`/api/temples/dated?dedication=${encodeURIComponent(dedication)}`)
            .then((r) => r.json())
            .then((data) => { if (alive) setDots(data.points ?? []); })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [dedication]);

    // ── Ось ──────────────────────────────────────────────────────────────────
    const periods = useMemo(() => {
        if (!dots?.length) return [];
        const first = Math.floor(dots[0].year / STEP) * STEP;
        const last = Math.floor(dots[dots.length - 1].year / STEP) * STEP;
        return Array.from({ length: (last - first) / STEP + 1 }, (_, i) => first + i * STEP);
    }, [dots]);

    // Открываем карту на ПОСЛЕДНЕМ шаге — то есть на всём, что есть. Пустая
    // карта, ждущая, чтобы её проиграли, выглядела бы как отсутствие данных.
    useEffect(() => { if (periods.length) setStep(periods.length - 1); }, [periods.length]);

    const upTo = periods.length ? periods[Math.min(step, periods.length - 1)] + STEP - 1 : 0;
    const shown = useMemo(() => (dots ?? []).filter((d) => d.year <= upTo), [dots, upTo]);

    // ── Числа этого шага ─────────────────────────────────────────────────────
    //
    // Ради них ось и заводилась: без чисел это была бы красивая мультипликация,
    // из которой ничего нельзя выписать.
    const spread = useMemo(() => spreadOf(shown.map((d) => ({ lat: d.y, lon: d.x }))), [shown]);
    const origin = useMemo(() => {
        if (!periods.length || !dots) return null;
        const firstPeriod = dots.filter((d) => d.year < periods[0] + STEP);
        return spreadOf(firstPeriod.map((d) => ({ lat: d.y, lon: d.x }))).center;
    }, [dots, periods]);
    const shift = useMemo(() => shiftOf(origin, spread.center), [origin, spread.center]);

    // ── Карта ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!node || map.current) return;

        // Стиль решает функция слоя, а не разметка каждой точки: построенное в
        // текущий полувек — ярко, прежнее — бледной подложкой, ещё не
        // построенное не рисуется вовсе (`undefined` — это «ничего»).
        const dots = new VectorLayer({
            source: source.current,
            style: (feature) => {
                const { from, upTo } = visible.current;
                const year = (feature.get("dot") as Dot).year;
                return year > upTo ? undefined : year >= from ? FRESH : EARLIER;
            },
        });
        layer.current = dots;

        const created = new Map({
            target: node,
            layers: [new TileLayer({ source: new OSM() }), dots],
            view: new View({ center: fromLonLat([35, 50]), zoom: 3 }),
        });
        map.current = created;

        /**
         * Подогнать вид, КОГДА КАРТА УЗНАЕТ СВОЙ РАЗМЕР.
         *
         * Полотно нередко возникает нулевым: свёрнутая панель, скрытая
         * вкладка, ещё не разложенная страница. Карта, подогнанная под нулевой
         * размер, получает бессмысленные средоточие и приближение — и остаётся
         * с ними навсегда, потому что второй раз подгонять её нечему. Поэтому
         * подгонка ждёт настоящего размера и делается один раз.
         */
        const fitWhenSized = () => {
            created.updateSize();
            const size = created.getSize();
            if (fitted.current || !box.current || !size?.[0] || !size?.[1]) return;
            created.getView().fit(box.current, { padding: [24, 24, 24, 24], maxZoom: 9 });
            fitted.current = true;
        };

        const resize = new ResizeObserver(fitWhenSized);
        resize.observe(node);
        const frame = requestAnimationFrame(fitWhenSized);

        created.on("click", (event) => {
            const hit = created.forEachFeatureAtPixel(event.pixel, (f) => f as Feature, { hitTolerance: HIT_TOLERANCE });
            const dot = hit?.get("dot") as Dot | undefined;
            if (dot) setPicked(dot);
        });
        created.on("pointermove", (event) => {
            if (event.dragging) return;
            const over = created.hasFeatureAtPixel(event.pixel, { hitTolerance: HIT_TOLERANCE });
            created.getTargetElement().style.cursor = over ? "pointer" : "";
        });

        return () => {
            cancelAnimationFrame(frame);
            resize.disconnect();
            created.setTarget(undefined);
            map.current = null;
        };
    }, [node]);

    // Точки кладём один раз, а шаг ползунка меняет только стиль: перекладывать
    // восемь сотен объектов на каждый полувек незачем.
    useEffect(() => {
        if (!dots?.length || !map.current) return;
        source.current.clear();
        source.current.addFeatures(dots.map((dot) => {
            const feature = new Feature({ geometry: new Point(fromLonLat([dot.x, dot.y])) });
            feature.set("dot", dot);
            return feature;
        }));

        // Вид — по рамке, вмещающей девять десятых точек, а не все.
        // Единственный храм в Аргентине иначе уводит карту на весь мир, и
        // страна, ради которой её открыли, становится пятном. Сами точки при
        // этом никуда не деваются: отбора здесь нет, есть начальный вид.
        const xs = dots.map((d) => d.x).sort((a, b) => a - b);
        const ys = dots.map((d) => d.y).sort((a, b) => a - b);
        const [w, s] = fromLonLat([quantile(xs, 0.05), quantile(ys, 0.05)]);
        const [e, n] = fromLonLat([quantile(xs, 0.95), quantile(ys, 0.95)]);
        if (e > w && n > s) {
            box.current = [w, s, e, n];
            const size = map.current.getSize();
            // Размер уже известен — подгоняем сразу; неизвестен — подгонит
            // наблюдатель размера, как только полотно его получит.
            if (size?.[0] && size?.[1]) {
                map.current.getView().fit(box.current, { padding: [24, 24, 24, 24], maxZoom: 9 });
                fitted.current = true;
            }
        }
        // `node` в зависимостях не лишний: карта заводится в том же обходе, что
        // и этот эффект, и без него точки легли бы в ещё не созданную карту —
        // то есть никуда, молча.
    }, [dots, node]);

    useEffect(() => {
        if (!periods.length) return;
        visible.current = { from: periods[Math.min(step, periods.length - 1)], upTo };
        layer.current?.changed();
    }, [step, periods, upTo, dots, node]);

    // ── Проигрывание ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!playing || !periods.length) return;
        const timer = setInterval(() => {
            setStep((current) => {
                if (current >= periods.length - 1) { setPlaying(false); return current; }
                return current + 1;
            });
        }, FRAME_MS);
        return () => clearInterval(timer);
    }, [playing, periods.length]);

    const onPlay = useCallback(() => {
        setPlaying((was) => {
            // Стоим в конце — проигрываем сначала, иначе кнопка не делала бы ничего.
            if (!was) setStep((current) => (current >= periods.length - 1 ? 0 : current));
            return !was;
        });
    }, [periods.length]);

    if (failed) {
        return <p className="font-serif text-slate-500">Датированные храмы не пришли — обновите страницу.</p>;
    }
    if (!dots) return <p className="font-serif text-slate-500">Собираю датированные храмы…</p>;
    if (!dots.length) return <p className="font-serif text-slate-500">Ни у одного храма этого посвящения год не проставлен.</p>;

    const current = periods[Math.min(step, periods.length - 1)];
    const fresh = shown.filter((d) => d.year >= current).length;

    return (
        <div>
            <div className="flex flex-row flex-wrap items-center gap-3 mb-2">
                <button
                    type="button"
                    onClick={onPlay}
                    className="font-serif border border-slate-300 rounded px-3 py-1 hover:bg-slate-50"
                >
                    {playing ? "Стоп" : "Проиграть"}
                </button>
                <input
                    type="range"
                    min={0}
                    max={Math.max(0, periods.length - 1)}
                    value={Math.min(step, periods.length - 1)}
                    onChange={(event) => { setPlaying(false); setStep(Number(event.target.value)); }}
                    aria-label="Полувек"
                    aria-valuetext={`${current}–${current + STEP - 1}`}
                    className="flex-1 min-w-[12rem] accent-amber-800"
                />
                <span className="font-serif tabular-nums">{current}–{current + STEP - 1}</span>
            </div>

            <div ref={setNode} className={`w-full ${height} rounded border border-slate-200`}
                 aria-label="Карта храмов этого посвящения по времени постройки" />

            <p className="font-serif text-slate-700 mt-2">
                К {upTo + 1} году — {templesCount(shown.length)} из {dots.length}
                {fresh > 0 && <>, из них {fresh} в этот полувек</>}.
                {spread.radiusMedianKm !== null && (
                    <> Половина стоит не далее {spread.radiusMedianKm} км от средоточия,
                       четыре пятых — не далее {spread.radius80Km} км.</>
                )}
                {shift && <> Средоточие ушло на {shift.km} км {shift.where} от первого полувека.</>}
            </p>

            <p className="font-serif text-sm text-slate-500 mt-1">
                Самый ранний датированный —{" "}
                <a className="text-amber-800 hover:underline" href={`/temples/${dots[0].s}`}>{dots[0].n}</a>
                , {dots[0].year}.
            </p>

            {picked && (
                <p className="font-serif mt-1">
                    <a className="text-amber-800 hover:underline" href={`/temples/${picked.s}`}>{picked.n}</a>
                    <span className="text-slate-500">, {picked.year}</span>
                </p>
            )}
        </div>
    );
};

export default DiffusionMap;
