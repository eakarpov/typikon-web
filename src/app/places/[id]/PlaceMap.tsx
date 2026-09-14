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
import { boundingExtent } from "ol/extent";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import Text from "ol/style/Text";
import "ol/ol.css";
import { useOlMap } from "@/app/components/map/useOlMap";

export type MapPointKind = "self" | "certain" | "probable" | "disputed" | "related";

export interface MapPoint { lon: number; lat: number; label: string; kind: MapPointKind }

// Цвет — достоверность: у места точка своя, у отождествлений она тем бледнее,
// чем меньше в ней уверенности. Подпись — имя, чтобы кандидаты различались.
const COLORS: Record<MapPointKind, string> = {
    self: "#7f1d1d",
    certain: "#1e40af",
    probable: "#3b82f6",
    disputed: "#93c5fd",
    related: "#64748b",
};

const styleOf = (point: MapPoint) => new Style({
    image: new CircleStyle({
        radius: point.kind === "self" ? 8 : 6,
        fill: new Fill({ color: COLORS[point.kind] }),
        stroke: new Stroke({ color: "#fff", width: 2 }),
    }),
    text: new Text({
        text: point.label,
        offsetY: -14,
        font: "12px serif",
        fill: new Fill({ color: "#1f2937" }),
        stroke: new Stroke({ color: "#fff", width: 3 }),
    }),
});

const PlaceMap = ({ points, name }: { points: MapPoint[]; name: string }) => {
    const target = useOlMap((node) => {
        const coords = points.map((p) => fromLonLat([p.lon, p.lat]));
        const features = points.map((p, i) => {
            const f = new Feature({ geometry: new Point(coords[i]) });
            f.setStyle(styleOf(p));
            return f;
        });
        const map = new Map({
            target: node,
            layers: [
                new TileLayer({ source: new OSM() }),
                new VectorLayer({ source: new VectorSource({ features }) }),
            ],
            view: new View({ center: coords[0], zoom: 9 }),
        });
        // Несколько точек — показываем все разом, но не ближе десятого масштаба: две
        // точки в соседних деревнях иначе растянули бы карту до улиц.
        if (coords.length > 1) {
            map.getView().fit(boundingExtent(coords), { padding: [40, 40, 40, 40], maxZoom: 10 });
        }
        return map;
    }, [JSON.stringify(points)]);

    return <div ref={target} className="w-full h-80 rounded border border-slate-200" aria-label={`Карта: ${name}`} />;
};

export default PlaceMap;
