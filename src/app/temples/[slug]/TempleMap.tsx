'use client';
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
import { useOlMap } from "@/app/components/map/useOlMap";

// Точка храма на карте. Карту строим на OpenLayers, как в разделе местностей
// (@/app/places): библиотека уже в зависимостях и уже умеет тайлы OSM.
// Размер и снятие карты с узла — в @/app/components/map/useOlMap.
const TempleMap = ({ latitude, longitude, name }: { latitude: number; longitude: number; name: string }) => {
    const target = useOlMap((node) => {
        const center = fromLonLat([longitude, latitude]);
        const point = new Feature({ geometry: new Point(center) });
        point.setStyle(new Style({
            image: new CircleStyle({
                radius: 7,
                fill: new Fill({ color: "#92400e" }),
                stroke: new Stroke({ color: "#fff", width: 2 }),
            }),
        }));

        return new Map({
            target: node,
            layers: [
                new TileLayer({ source: new OSM() }),
                new VectorLayer({ source: new VectorSource({ features: [point] }) }),
            ],
            view: new View({ center, zoom: 14 }),
        });
    }, [latitude, longitude]);

    return (
        <div className="mt-4">
            <div ref={target} className="w-full h-72 rounded border border-slate-200" aria-label={`Карта: ${name}`} />
        </div>
    );
};

export default TempleMap;
