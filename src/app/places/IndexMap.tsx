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
import "ol/ol.css";
import { useOlMap } from "@/app/components/map/useOlMap";

export interface IndexPoint { lon: number; lat: number; name: string; href: string; scripture: boolean }

// Точки указателя. Подписей нет: в Палестине их сотни на ладонь карты, и они
// слились бы в пятно. Имя — во всплывающей подсказке, переход — по щелчку.
const style = (scripture: boolean) => new Style({
    image: new CircleStyle({
        radius: scripture ? 5 : 4,
        fill: new Fill({ color: scripture ? "#7f1d1d" : "#64748b" }),
        stroke: new Stroke({ color: "#fff", width: 1 }),
    }),
});

const IndexMap = ({ points }: { points: IndexPoint[] }) => {
    const target = useOlMap((node) => {
        const coords = points.map((p) => fromLonLat([p.lon, p.lat]));
        const features = points.map((p, i) => {
            const f = new Feature({ geometry: new Point(coords[i]), name: p.name, href: p.href });
            f.setStyle(style(p.scripture));
            return f;
        });
        const map = new Map({
            target: node,
            layers: [
                new TileLayer({ source: new OSM() }),
                new VectorLayer({ source: new VectorSource({ features }) }),
            ],
            view: new View({ center: fromLonLat([35.2, 31.8]), zoom: 5 }),
        });
        if (coords.length > 1) map.getView().fit(boundingExtent(coords), { padding: [30, 30, 30, 30], maxZoom: 9 });

        map.on("pointermove", (event) => {
            const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f);
            node.title = feature ? String(feature.get("name")) : "";
            node.style.cursor = feature ? "pointer" : "";
        });
        map.on("click", (event) => {
            const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f);
            if (feature) window.location.href = String(feature.get("href"));
        });
        return map;
    }, [points.length, points[0]?.href]);

    return <div ref={target} className="w-full h-96 rounded border border-slate-200" aria-label="Карта мест" />;
};

export default IndexMap;
