'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import { Point } from "ol/geom";
import { fromLonLat, toLonLat } from "ol/proj";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import Text from "ol/style/Text";
import "ol/ol.css";
import { temples as templesCount } from "@/utils/plural";

// Карта храмов. Каталог всемирный и на десятки тысяч записей, поэтому сводит
// их в гнёзда сервер, а не браузер: свести в браузере можно, но для этого все
// точки надо сперва привезти, а их десятки тысяч.
//
// ГНЕЗДО ИЛИ ХРАМ — РЕШАЕТ СЕТКА, А НЕ ПРИБЛИЖЕНИЕ. Клетка всегда одного
// размера на экране; где в неё попал один храм, приходит он сам, с именем и
// адресом, где несколько — число. Порог по масштабу («ближе девятого шага
// показываем поодиночке») делил карту не по тому признаку: посреди
// Владимирской области девять сотен отдельных точек слипаются в кашу и на
// девятом шаге, а в пустыне и на третьем показывать нечего, кроме одинокого
// храма.

interface Cell { x: number; y: number; n: number; s?: string; name?: string }

const cellStyle = (n: number) => new Style({
    image: new CircleStyle({
        radius: Math.min(20, 7 + Math.log2(n + 1) * 2),
        fill: new Fill({ color: "rgba(146,64,14,0.72)" }),
        stroke: new Stroke({ color: "#fff", width: 2 }),
    }),
    text: new Text({ text: String(n), fill: new Fill({ color: "#fff" }), font: "11px sans-serif" }),
});

// Отдельный храм — не точка, а МИШЕНЬ: по нему кликают, чтобы открыть
// карточку. Пятью пикселями в неё не попасть ни мышью на весу, ни пальцем.
const pointStyle = new Style({
    image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: "#92400e" }),
        stroke: new Stroke({ color: "#fff", width: 2 }),
    }),
});

/** Промах в несколько точек засчитываем попаданием — палец толще курсора. */
const HIT_TOLERANCE = 10;

const TemplesMap = ({ query, dedication, height = "h-[70vh]" }: {
    query?: string;
    dedication?: string;
    /** Высота полотна: на странице посвящения карта — часть разбора, а не вся страница. */
    height?: string;
}) => {
    const target = useRef<HTMLDivElement>(null);
    const map = useRef<Map | null>(null);
    const source = useRef(new VectorSource());
    const [status, setStatus] = useState("Собираю…");
    // Номер запроса. Ответы приходят НЕ В ТОМ ПОРЯДКЕ, в каком их просили:
    // всемирный вид считается по всей базе и отвечает медленнее ближнего, а
    // приходит последним — и затирает уже отрисованную область прежними
    // гнёздами. Внешне это выглядело как «карта не обновляется при
    // приближении», хотя нужный ответ давно пришёл и был показан.
    const request = useRef(0);
    const [picked, setPicked] = useState<{ slug: string; name: string } | null>(null);

    const load = useCallback(async () => {
        const current = map.current;
        if (!current) return;
        const view = current.getView();
        const zoom = view.getZoom() ?? 3;
        const extent = view.calculateExtent(current.getSize() ?? [800, 600]);
        const [w, s] = toLonLat([extent[0], extent[1]]);
        const [e, n] = toLonLat([extent[2], extent[3]]);

        const search = new URLSearchParams({ zoom: zoom.toFixed(2), bbox: [w, s, e, n].map((v) => v.toFixed(4)).join(",") });
        if (query) search.set("q", query);
        if (dedication) search.set("dedication", dedication);

        const mine = ++request.current;
        try {
            const data = await fetch(`/api/temples/points?${search}`).then((r) => r.json());
            // Пока ходили, карту успели подвинуть — этот ответ уже не о том,
            // что на экране.
            if (mine !== request.current) return;
            source.current.clear();
            source.current.addFeatures((data.cells as Cell[]).map((c) => {
                const feature = new Feature({ geometry: new Point(fromLonLat([c.x, c.y])) });
                if (c.n === 1) {
                    feature.setStyle(pointStyle);
                    feature.set("slug", c.s);
                    feature.set("name", c.name);
                } else {
                    feature.setStyle(cellStyle(c.n));
                }
                return feature;
            }));
            const grouped = data.total - data.alone;
            setStatus(grouped > 0
                ? `${templesCount(data.total)} в этой части карты; ${grouped} сведены в гнёзда — в кружке написано, сколько их. Приблизьте, чтобы разошлись.`
                : `${templesCount(data.total)} в этой части карты, все по отдельности.`);
        } catch {
            if (mine === request.current) setStatus("Точки не пришли — попробуйте подвинуть карту.");
        }
    }, [query, dedication]);

    useEffect(() => {
        if (!target.current) return;

        const created = new Map({
            target: target.current,
            layers: [
                new TileLayer({ source: new OSM() }),
                new VectorLayer({ source: source.current }),
            ],
            // Вид на восточную Европу: там сгущение, ради которого карту и
            // открывают. Мир целиком показывать незачем — половину его занимает
            // океан.
            view: new View({ center: fromLonLat([35, 50]), zoom: dedication ? 3.4 : 4 }),
        });
        map.current = created;

        // Размер узла к постройке ещё не известен, и без переспроса карта не
        // запрашивает ни одной плитки: подложка остаётся пустой, а метки
        // рисуются — изъян выглядит как «карта без карты».
        const resize = new ResizeObserver(() => created.updateSize());
        resize.observe(target.current);
        const frame = requestAnimationFrame(() => created.updateSize());

        created.on("click", (event) => {
            const hit = created.forEachFeatureAtPixel(event.pixel, (f) => f as Feature, { hitTolerance: HIT_TOLERANCE });
            if (!hit) return;
            const slug = hit.get("slug");
            if (slug) { setPicked({ slug, name: hit.get("name") }); return; }
            // По гнезду приближаемся, а не гадаем, какой из полусотни храмов
            // имелся в виду.
            created.getView().animate({
                center: (hit.getGeometry() as Point).getCoordinates(),
                zoom: Math.min(17, (created.getView().getZoom() ?? 4) + 3),
            });
        });

        // Ждём конца движения: перезапрашивать на каждом кадре перетаскивания —
        // это сотня запросов на один жест.
        // Курсор-указатель над тем, по чему есть смысл щёлкать: иначе не
        // понять, живая метка или украшение.
        created.on("pointermove", (event) => {
            if (event.dragging) return;
            const over = created.hasFeatureAtPixel(event.pixel, { hitTolerance: HIT_TOLERANCE });
            created.getTargetElement().style.cursor = over ? "pointer" : "";
        });

        created.on("moveend", () => { void load(); });
        void load();

        return () => {
            cancelAnimationFrame(frame);
            resize.disconnect();
            created.setTarget(undefined);
            map.current = null;
        };
        // dedication здесь ради начального приближения: у отбора точек меньше,
        // и мир целиком показывать незачем. Само по себе оно меняется вместе с
        // load, но полагаться на это молча — значит оставить ловушку тому, кто
        // однажды перепишет load.
    }, [load, dedication]);

    return (
        <div>
            <p className="font-serif text-slate-500 mb-2">{status}</p>
            <div ref={target} className={`w-full ${height} rounded border border-slate-200`} aria-label="Карта храмов" />
            {picked && (
                <p className="font-serif mt-2">
                    <a className="text-amber-800 hover:underline" href={`/temples/${picked.slug}`}>{picked.name}</a>
                </p>
            )}
        </div>
    );
};

export default TemplesMap;
