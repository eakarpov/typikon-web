import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceKm, quantile, shiftOf, spreadOf, NOTABLE_SHIFT_KM } from "@/lib/geoSpread";

test("градус широты — сто одиннадцать вёрст, градус долготы на широте 60 — вдвое меньше", () => {
    assert.equal(Math.round(distanceKm(55, 37, 56, 37)), 111);
    assert.equal(Math.round(distanceKm(60, 37, 60, 38)), 56);
});

test("средоточие — медиана, и один храм в диаспоре его не уводит", () => {
    // Четыре точки кучей под Москвой и одна в Аргентине. Среднее уехало бы за
    // океан, медиана остаётся там, где стоят храмы.
    const points = [
        { lat: 55.7, lon: 37.6 }, { lat: 55.8, lon: 37.5 },
        { lat: 55.6, lon: 37.7 }, { lat: 55.9, lon: 37.4 },
        { lat: -34.6, lon: -58.4 },
    ];
    const spread = spreadOf(points);
    assert.ok(spread.center!.lat > 55 && spread.center!.lat < 56);
    assert.ok(spread.center!.lon > 37 && spread.center!.lon < 38);
    // Половина точек — рядом со средоточием, и медианный радиус это показывает.
    assert.ok(spread.radiusMedianKm! < 30);
    // А четыре пятых уже включают заокеанскую: ареал такой, какой есть.
    assert.ok(spread.radius80Km! > 5000);
});

test("пустой набор не выдумывает ни средоточия, ни ареала", () => {
    assert.deepEqual(spreadOf([]), { center: null, radiusMedianKm: null, radius80Km: null });
});

test("квантиль берёт значение ряда, а не выводит промежуточное", () => {
    const row = [1, 2, 3, 4];
    assert.equal(quantile(row, 0), 1);
    assert.equal(quantile(row, 0.5), 3);
    assert.equal(quantile(row, 1), 4);
});

test("румб сдвига называется от севера по часовой стрелке", () => {
    const from = { lat: 55, lon: 37 };
    assert.equal(shiftOf(from, { lat: 58, lon: 37 })?.where, "к северу");
    assert.equal(shiftOf(from, { lat: 55, lon: 42 })?.where, "к востоку");
    assert.equal(shiftOf(from, { lat: 52, lon: 37 })?.where, "к югу");
    assert.equal(shiftOf(from, { lat: 55, lon: 32 })?.where, "к западу");
    assert.equal(shiftOf(from, { lat: 57, lon: 40 })?.where, "к северо-востоку");
    assert.equal(shiftOf(from, { lat: 53, lon: 34 })?.where, "к юго-западу");
});

test("мелкий сдвиг не называется движением", () => {
    // Полградуса широты — 55 км, чуть выше порога; десятая доля — 11 км, шум.
    assert.equal(shiftOf({ lat: 55, lon: 37 }, { lat: 55.1, lon: 37 }), null);
    assert.ok(shiftOf({ lat: 55, lon: 37 }, { lat: 55.5, lon: 37 })!.km >= NOTABLE_SHIFT_KM);
    assert.equal(shiftOf(null, { lat: 55, lon: 37 }), null);
});
