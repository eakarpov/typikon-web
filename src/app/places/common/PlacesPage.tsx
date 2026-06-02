'use client';
import React, {useEffect} from "react";
import {fromLonLat} from "ol/proj";
import Vector from "ol/source/Vector";
import {Point} from "ol/geom";
import Feature, {FeatureLike} from "ol/Feature";
import {Heatmap} from "ol/layer";
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import Text from 'ol/style/Text.js';
import "ol/ol.css";

const data = [
    {
        title: "test",
        latitude: 51.3,
        longitude: 50.4,
    }
];

function truncate(string: string, n: number) {
    return string.length > n ? string.slice(0, n - 1) + '…' : string.slice();
}

function stringDivider(str: string, width: number, spaceReplacer: string): string {
    if (str.length > width) {
        let p = width;
        while (p > 0 && str[p] != ' ' && str[p] != '-') {
            p--;
        }
        if (p > 0) {
            let left;
            if (str.substring(p, p + 1) == '-') {
                left = str.substring(0, p + 1);
            } else {
                left = str.substring(0, p);
            }
            const right = str.substring(p + 1);
            return left + spaceReplacer + stringDivider(right, width, spaceReplacer);
        }
    }
    return str;
}

const myDom = {
    points: {
        text: {
            value: "wrap"
        },
        align: {
            value: "left"
        },
        baseline: {
            value: "middle"
        },
        rotation: {
            value: "0deg",
        },
        font: {
            value: "Arial"
        },
        weight: {
            value: "bold",
        },
        size: {
            value: "12px"
        },
        height: {
            value: "1em"
        },
        offsetX: {
            value: "0"
        },
        offsetY: {
            value: "0"
        },
        color: {
            value: "#aa3300"
        },
        outline: {
            value: "#fff"
        },
        outlineWidth: {
            value: "3px"
        },
        maxreso: {
            value: 1200
        },

        overflow: {
          value: "true",
        },
        maxangle: {
            value: "45deg",
        },
        placement: {
            value: undefined,
        },
    },
};

const getText = function (feature: FeatureLike, resolution: number, dom: typeof myDom.points) {
    const type = dom.text.value;
    const maxResolution = dom.maxreso.value;
    let text = feature.get('name');

    if (resolution > maxResolution) {
        text = '';
    } else if (type == 'hide') {
        text = '';
    } else if (type == 'shorten') {
        text = truncate(text, 12);
    } else if (
        type == 'wrap' &&
        (!dom.placement || dom.placement.value != 'line')
    ) {
        text = stringDivider(text, 16, '\n');
    }

    return text;
};

const createTextStyle = function (feature: FeatureLike, resolution: number, dom: typeof myDom.points) {
    const align = dom.align.value;
    const baseline = dom.baseline.value;
    const size = dom.size.value;
    const height = dom.height.value;
    const offsetX = parseInt(dom.offsetX.value, 10);
    const offsetY = parseInt(dom.offsetY.value, 10);
    const weight = dom.weight.value;
    const placement = dom.placement ? dom.placement.value : undefined;
    const maxAngle = dom.maxangle ? parseFloat(dom.maxangle.value) : undefined;
    const overflow = dom.overflow ? dom.overflow.value == 'true' : undefined;
    const rotation = parseFloat(dom.rotation.value);
    const font = weight + ' ' + size + '/' + height + ' ' + dom.font.value;
    const fillColor = dom.color.value;
    const outlineColor = dom.outline.value;
    const outlineWidth = parseInt(dom.outlineWidth.value, 10);

    return new Text({
        // @ts-ignore
        textAlign: align == '' ? undefined : align,
        // @ts-ignore
        textBaseline: baseline,
        font: font,
        text: getText(feature, resolution, dom),
        fill: new Fill({color: fillColor}),
        stroke: new Stroke({color: outlineColor, width: outlineWidth}),
        offsetX: offsetX,
        offsetY: offsetY,
        placement: placement,
        maxAngle: maxAngle,
        overflow: overflow,
        rotation: rotation,
    });
};

// Points
function pointStyleFunction(feature: FeatureLike, resolution: number) {
    return new Style({
        image: new CircleStyle({
            radius: 10,
            fill: new Fill({color: 'rgba(255, 0, 0, 0.1)'}),
            stroke: new Stroke({color: feature.get('color'), width: 1}),
        }),
        text: createTextStyle(feature, resolution, myDom.points),
    });
}

const customSource = new VectorSource({
    loader: function (extent, resolution, projection, success, failure) {
        import("./data2.json")
            .then(response => response.default)
            .then(data => {
                const features = data.map(item => {
                    const to = item.destroyedAt ? ` - ${item.destroyedAt}` : '';
                    const name = `${item.name} (${item.createdAt}${to})`;
                    return new Feature({
                        geometry: new Point(fromLonLat([item.lon, item.lat])),
                        name,
                        color: item.color,
                    });
                });

                customSource.addFeatures(features);
                success!(features);
            })
            .catch(error => {
                failure!();
                console.error('Failed to load JSON:', error);
            });
    }
});

const PlacesPage = () => {
    const item = data[0];

    const init = async () => {
        // @ts-ignore
        document.getElementById("map").innerHTML = "";

        const latitude = item.latitude;
        const longitude = item.longitude;

        // green center
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

        const vectorPoints = new VectorLayer({
            source: customSource,
            style: pointStyleFunction,
        });

        const map = new Map({
            layers: [
                new TileLayer({
                    source: new OSM(),
                }),
                vectorPoints,
            ],
            target: 'map',
            view: new View({
                center: fromLonLat([longitude, latitude]),
                zoom: 4,
            }),
        });
        // map.addLayer(heatMapLayer);

        map.on('click', (e) => {
            const feature = map.forEachFeatureAtPixel(e.pixel, function (feature) {
                return feature;
            });

            if (feature) {
                const name = feature.get('name');
                console.log(feature, name);
            }
        });
    };

    useEffect(() => {
        init();
    }, [item]);
    return (
        <>
            <div className="flex flex-col mb-2">
                <span className="text-xl">
                    Карта славянских поселений (до 14 вв. по РХ)&nbsp;
                    <span style={{ color: "black", fontSize: 12, paddingLeft: '4px' }}>
                        Города до 5 в. по РХ
                    </span>
                    <span style={{ color: "red", fontSize: 12, paddingLeft: '4px'}}>
                        Города с 5 по 10 вв. по РХ
                    </span>
                    <span style={{ color: "green", fontSize: 12, paddingLeft: '4px'}}>
                        Города с 10 по 14 вв. по РХ
                    </span>
                </span>
            </div>
            <div id="map" style={{ height: 'calc(100vh - 100px)', width: '100%'}} />
        </>
    );
}

export default PlacesPage;
