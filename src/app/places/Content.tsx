'use client';
import React, {useEffect, useRef} from "react";
import Map from 'ol/Map';
import View from 'ol/View';
import Vector from "ol/source/Vector";
import TileLayer from 'ol/layer/Tile';
import OSM from "ol/source/OSM";
import Feature from "ol/Feature";
import {fromLonLat} from "ol/proj";
import {Point} from "ol/geom";
import {Heatmap} from "ol/layer";

const Content = () => {
    useEffect(() => {
        const source = new OSM();
        const layer = new TileLayer({
            source: source,
        });
        document.getElementById("map").innerHTML = "";
        const map = new Map({
            layers: [layer],
            target: "map",
            view: new View({
                center: fromLonLat([2.1734, 41.3851]),
                zoom: 10,
            }),
        });
        const data = new Vector();
        const coord = fromLonLat([2.1734, 41.3851]);  // Barcelona, Spain
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
        console.log(map);
    }, []);
    return (
        <>
            <div id="map" style={{ height: '300px', width: '600px'}} />
        </>
    );
};

export default Content;