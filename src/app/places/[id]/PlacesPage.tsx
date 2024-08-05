'use client';
import React, {useEffect} from "react";
import OSM from "ol/source/OSM";
import TileLayer from "ol/layer/Tile";
import Map from "ol/Map";
import View from "ol/View";
import {fromLonLat} from "ol/proj";
import Vector from "ol/source/Vector";
import {Point} from "ol/geom";
import Feature from "ol/Feature";
import {Heatmap} from "ol/layer";

const PlacesPage = ({ item }: {item: any}) => {

    console.log(item);

    useEffect(() => {
        const source = new OSM();
        const layer = new TileLayer({
            source: source,
        });
        document.getElementById("map").innerHTML = "";
        const latitude = parseFloat(item.latitude);
        const longitude = parseFloat(item.longitude);
        console.log(longitude, latitude);
        const map = new Map({
            layers: [layer],
            target: "map",
            view: new View({
                center: fromLonLat([longitude, latitude]),
                zoom: 10,
            }),
        });
        const data = new Vector();
        const coord = fromLonLat([longitude, latitude]);
        const lonLat = new Point(coord);
        const pointFeature = new Feature({
            geometry: lonLat,
            weight: 50,
        });
        data.addFeature(pointFeature);

        const heatMapLayer = new Heatmap({
            source: data,
            radius: 10,
        });
        map.addLayer(heatMapLayer);
    }, [item]);
    return (
        <>
            <div className="flex flex-col mb-2">
                <span className="text-xl">
                    Местность
                </span>
                <span className="text-bold">
                    Город: {item.name}
                </span>
                {item.synonyms && (
                    <span>
                        Синонимы: {item.synonyms.join(',')}
                    </span>
                )}
                {item.links && (
                    <span>
                        Ссылки: {item.links.map(link => (
                            <span>
                                <a href={link.url} target="_blank">{link.text}</a>
                            </span>
                        ))}
                    </span>
                )}
            </div>
            <div id="map" style={{ height: '300px', width: '600px'}} />
        </>
    );
}

export default PlacesPage;
