'use client';
import { useRouter } from "next/navigation";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import { Circle as CircleGeom, Point } from "ol/geom";
import { fromLonLat, toLonLat } from "ol/proj";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import "ol/ol.css";
import { useOlMap } from "@/app/components/map/useOlMap";
import { roundCoord } from "@/lib/pilgrimage/summary";

// Карта «что рядом»: точка, круг радиуса, храмы и святыни. Щелчок по пустому
// месту карты переносит точку туда — это и есть запасной путь для того, кто
// не хочет или не может отдать браузеру своё место.

export interface MapTemple { slug: string; name: string; lat: number; lon: number }
export interface MapRelic { templeSlug: string | null; lat: number; lon: number; name: string }

const dot = (radius: number, color: string) => new Style({
    image: new CircleStyle({ radius, fill: new Fill({ color }), stroke: new Stroke({ color: "#fff", width: 2 }) }),
});

const NearbyMap = ({ center, radiusKm, temples, relics }: {
    center: { lat: number; lon: number } | null;
    radiusKm: number;
    temples: MapTemple[];
    relics: MapRelic[];
}) => {
    const router = useRouter();

    const target = useOlMap((node) => {
        const features: Feature[] = [];
        if (center) {
            const c = fromLonLat([center.lon, center.lat]);
            // Круг рисуется в проекции карты, а она растягивает широты: делим
            // радиус на косинус широты, иначе круг на севере выйдет мельче.
            const stretch = 1 / Math.cos((center.lat * Math.PI) / 180);
            const ring = new Feature({ geometry: new CircleGeom(c, radiusKm * 1000 * stretch) });
            ring.setStyle(new Style({ stroke: new Stroke({ color: "#92400e", width: 1, lineDash: [4, 4] }) }));
            const me = new Feature({ geometry: new Point(c) });
            me.setStyle(dot(6, "#1e3a8a"));
            features.push(ring, me);
        }
        for (const t of temples) {
            const f = new Feature({ geometry: new Point(fromLonLat([t.lon, t.lat])), href: `/temples/${t.slug}`, name: t.name });
            f.setStyle(dot(5, "#92400e"));
            features.push(f);
        }
        for (const r of relics) {
            const f = new Feature({
                geometry: new Point(fromLonLat([r.lon, r.lat])),
                href: r.templeSlug ? `/temples/${r.templeSlug}` : undefined, name: r.name,
            });
            f.setStyle(dot(8, "#b91c1c"));
            features.push(f);
        }

        const map = new Map({
            target: node,
            layers: [
                new TileLayer({ source: new OSM() }),
                new VectorLayer({ source: new VectorSource({ features }) }),
            ],
            view: new View({
                center: fromLonLat(center ? [center.lon, center.lat] : [37.62, 55.75]),
                zoom: center ? (radiusKm <= 5 ? 12 : radiusKm <= 15 ? 10 : radiusKm <= 30 ? 9 : 8) : 4,
            }),
        });

        map.on("singleclick", (e) => {
            const hit = map.forEachFeatureAtPixel(e.pixel, (f) => f.get("href") ? f : undefined, { hitTolerance: 4 });
            if (hit) { router.push(hit.get("href")); return; }
            const [lon, lat] = toLonLat(e.coordinate);
            router.push(`/ryadom?lat=${roundCoord(lat)}&lon=${roundCoord(((lon + 540) % 360) - 180)}&r=${radiusKm}`);
        });
        map.on("pointermove", (e) => {
            const over = map.hasFeatureAtPixel(e.pixel, { layerFilter: (l) => l instanceof VectorLayer, hitTolerance: 4 });
            (map.getTargetElement() as HTMLElement).style.cursor = over ? "pointer" : "crosshair";
        });
        return map;
    }, [center?.lat, center?.lon, radiusKm, temples.length, relics.length]);

    return (
        <div>
            <div ref={target} className="w-full h-80 rounded border border-slate-200" aria-label="Карта: храмы и святыни рядом" />
            <p className="font-serif text-xs text-slate-500 mt-1">
                Щелчок по карте переносит точку. Коричневые — храмы, красные — святыни. © участники OpenStreetMap.
            </p>
        </div>
    );
};

export default NearbyMap;
