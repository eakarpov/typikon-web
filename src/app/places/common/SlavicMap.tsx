'use client';
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import { LineString, Point } from "ol/geom";
import { fromLonLat } from "ol/proj";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import Text from "ol/style/Text";
import "ol/ol.css";
import { useOlMap } from "@/app/components/map/useOlMap";
import { ERA_COLORS } from "@/lib/places/centuries";

export interface SlavicMapPoint { name: string; href: string; lon: number; lat: number; era: "ancient" | "early" | "medieval" | null; label: string }
export interface SlavicMapRoute { name: string; href: string; coordinates: [number, number][] }


const pointStyle = (p: SlavicMapPoint) => new Style({
    image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: "rgba(255,255,255,0.6)" }),
        stroke: new Stroke({ color: p.era ? ERA_COLORS[p.era] : "#64748b", width: 2 }),
    }),
    text: new Text({
        text: p.label, offsetY: -14, font: "11px serif",
        fill: new Fill({ color: "#1f2937" }), stroke: new Stroke({ color: "#fff", width: 3 }),
    }),
});

const SlavicMap = ({ points, routes }: { points: SlavicMapPoint[]; routes: SlavicMapRoute[] }) => {
    const target = useOlMap((node) => {
        const features = [
            ...routes.map((r) => {
                const f = new Feature({ geometry: new LineString(r.coordinates.map((c) => fromLonLat(c))), name: r.name, href: r.href });
                f.setStyle(new Style({
                    stroke: new Stroke({ color: "#1d4ed8", width: 2 }),
                    text: new Text({ text: r.name, placement: "line", font: "bold 12px serif", fill: new Fill({ color: "#1d4ed8" }), stroke: new Stroke({ color: "#fff", width: 3 }) }),
                }));
                return f;
            }),
            ...points.map((p) => {
                const f = new Feature({ geometry: new Point(fromLonLat([p.lon, p.lat])), name: p.name, href: p.href });
                f.setStyle(pointStyle(p));
                return f;
            }),
        ];
        const map = new Map({
            target: node,
            layers: [new TileLayer({ source: new OSM() }), new VectorLayer({ source: new VectorSource({ features }), declutter: true })],
            view: new View({ center: fromLonLat([30, 51]), zoom: 4 }),
        });
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
    }, [points.length, routes.length]);

    return <div ref={target} className="w-full rounded border border-slate-200" style={{ height: "calc(100vh - 180px)", minHeight: 400 }} aria-label="Карта славянских поселений" />;
};

export default SlavicMap;
