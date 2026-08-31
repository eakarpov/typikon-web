'use client';
import { useEffect, useRef } from "react";
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

// Точка храма на карте. Карту строим на OpenLayers, как в разделе местностей
// (@/app/places): библиотека уже в зависимостях и уже умеет тайлы OSM.
//
// Ссылка на узел, а не на самодельный div: прежний код в /places звал
// document.getElementById и чистил innerHTML руками, отчего при повторном
// показе карта строилась поверх недоубранной.
const TempleMap = ({ latitude, longitude, name }: { latitude: number; longitude: number; name: string }) => {
    const target = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!target.current) return;
        const center = fromLonLat([longitude, latitude]);
        const point = new Feature({ geometry: new Point(center) });
        point.setStyle(new Style({
            image: new CircleStyle({
                radius: 7,
                fill: new Fill({ color: "#92400e" }),
                stroke: new Stroke({ color: "#fff", width: 2 }),
            }),
        }));

        const map = new Map({
            target: target.current,
            layers: [
                new TileLayer({ source: new OSM() }),
                new VectorLayer({ source: new VectorSource({ features: [point] }) }),
            ],
            view: new View({ center, zoom: 14 }),
        });

        // РАЗМЕР НАДО ПЕРЕСПРОСИТЬ. Карта меряет узел в тот миг, когда её
        // строят, а строится она из эффекта — вёрстка к этому моменту ширины
        // ещё не дала, и карта запоминает ширину 0. Дальше она честно решает,
        // что покрывать нечего, и НЕ ЗАПРАШИВАЕТ НИ ОДНОЙ ПЛИТКИ: подложка
        // остаётся пустой, а метка при этом рисуется — оттого изъян и выглядит
        // как «карта без карты». Тем же болеет и старая карта в /places.
        //
        // Наблюдатель, а не один updateSize: ширина меняется и потом — при
        // повороте телефона и когда рядом разворачивается меню.
        const resize = new ResizeObserver(() => map.updateSize());
        resize.observe(target.current);
        // И один раз сразу следующим кадром: наблюдатель сообщает об
        // ИЗМЕНЕНИИ, а если узел к первому замеру уже стоял в своей ширине,
        // менять нечего — и неверно снятый размер так и остался бы.
        const frame = requestAnimationFrame(() => map.updateSize());

        // Карту обязательно снимаем с узла: без этого переход на соседний храм
        // оставляет прежнюю карту висеть на том же месте.
        return () => {
            cancelAnimationFrame(frame);
            resize.disconnect();
            map.setTarget(undefined);
        };
    }, [latitude, longitude]);

    return (
        <div className="mt-4">
            <div ref={target} className="w-full h-72 rounded border border-slate-200" aria-label={`Карта: ${name}`} />
        </div>
    );
};

export default TempleMap;
