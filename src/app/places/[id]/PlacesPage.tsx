'use client';
import React from "react";
import OSM from "ol/source/OSM";
import TileLayer from "ol/layer/Tile";
import Map from "ol/Map";
import View from "ol/View";
import {fromLonLat} from "ol/proj";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import {Point} from "ol/geom";
import Feature from "ol/Feature";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import "ol/ol.css";
import {useOlMap} from "@/app/components/map/useOlMap";
import {placeCoordinates} from "@/lib/places/legacy";

// Карта рисуется, только если у места есть точка: у «пустыни Иорданской» её
// может и не быть, и точка посреди Атлантики хуже, чем отсутствие карты.
const PlaceMap = ({ latitude, longitude, name }: { latitude: number; longitude: number; name: string }) => {
    const target = useOlMap((node) => {
        const center = fromLonLat([longitude, latitude]);
        const point = new Feature({ geometry: new Point(center) });
        point.setStyle(new Style({
            image: new CircleStyle({
                radius: 7,
                fill: new Fill({ color: "#1e40af" }),
                stroke: new Stroke({ color: "#fff", width: 2 }),
            }),
        }));
        return new Map({
            target: node,
            layers: [
                new TileLayer({ source: new OSM() }),
                new VectorLayer({ source: new VectorSource({ features: [point] }) }),
            ],
            view: new View({ center, zoom: 10 }),
        });
    }, [latitude, longitude]);

    return <div ref={target} className="w-full h-72 rounded border border-slate-200" aria-label={`Карта: ${name}`} />;
};

const PlacesPage = ({ item }: {item: any}) => {
    const point = placeCoordinates(item);
    return (
        <>
            <div className="flex flex-col mb-2">
                <span className="text-xl">
                    {item.name}
                </span>
                {item.synonyms?.length > 0 && (
                    <span>
                        Другие имена: {item.synonyms.join(', ')}
                    </span>
                )}
                {item.links?.length > 0 && (
                    <span>
                        Ссылки: {item.links.map((link: any) => (
                            <span key={link.url}>
                                <a href={link.url} target="_blank" rel="noreferrer">{link.text}</a>
                            </span>
                        ))}
                    </span>
                )}
            </div>
            {point && <PlaceMap latitude={point.latitude} longitude={point.longitude} name={item.name} />}
        </>
    );
}

export default PlacesPage;
