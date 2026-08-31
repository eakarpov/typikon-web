// Страна храма — по его точке на карте.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ШАГ. Страну надо знать ради Церкви, а Церковь — ради устава:
// службу афинского прихода нельзя собирать по русскому уставу. Но в источниках
// страны почти нет. В OSM её ставят тегом `addr:country`, и ставят редко — из
// восемнадцати тысяч привезённых записей он есть у считанных сотен. Зато
// координата есть у КАЖДОЙ: страна из неё и выводится.
//
// ГРАНИЦЫ ГРУБЫЕ, и это осознанно. Natural Earth 110m (общественное достояние,
// 248 КБ) даёт очертания с точностью до километров: для «в какой стране храм»
// этого хватает с запасом, а подробные границы весили бы десятки мегабайт ради
// той же самой буквы кода. Спорными выходят только острова и приграничные
// сёла; такие остаются без страны, а не приписываются наугад.
//
// ФАЙЛ ГРАНИЦ СКРИПТ ДОБЫВАЕТ САМ. В git он не едет: `script-data/*` там
// исключён, и по уговору проекта в этой папке лежит рабочее, а не исходное —
// словарь ударений, выгрузка имён святцев. Скрипт, требующий файла, которого в
// репозитории нет, на сервере просто не запустится, поэтому недостающее он
// скачивает и обрезает до нужного: код страны, русское имя, контур.
//
// ЮРИСДИКЦИЯ ПЕРЕСЧИТЫВАЕТСЯ ЗАОДНО: у большинства объектов OSM исповедание
// помечено просто «orthodox», и Церковь для них выводится как раз из страны.
// Вывод помечается выводом (churchSource: "country") — в диаспоре он неверен,
// и выдавать его за сказанное источником нельзя.
//
// Запуск:  npm run temples:countries [-- --write]
import "@/scripts/lib/env";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import clientPromise from "@/lib/mongodb";
import { resolveChurch } from "@/utils/jurisdictions";

interface CountryFeature {
    properties: { iso: string; name: string };
    geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

/** Луч вправо: нечётное число пересечений — точка внутри. Дыры считаются так же. */
const inRing = (ring: number[][], x: number, y: number): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
};

/** Внутри контура, но не внутри его дыр: у полигона первое кольцо внешнее. */
const inPolygon = (rings: number[][][], x: number, y: number): boolean => {
    if (!rings.length || !inRing(rings[0], x, y)) return false;
    return !rings.slice(1).some((hole) => inRing(hole, x, y));
};

/** Natural Earth, общественное достояние. Очертания 1:110 000 000. */
const SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const ensureBoundaries = async (file: string): Promise<CountryFeature[]> => {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")).features as CountryFeature[];

    console.log("границ нет — качаю Natural Earth…");
    const response = await fetch(SOURCE, { headers: { "User-Agent": "typikon-web/1.0 (temples import)" } });
    if (!response.ok) throw new Error(`не скачать границы: HTTP ${response.status}`);
    const raw = await response.json() as { features: any[] };

    // Обрезаем до нужного: полный файл везёт полсотни полей на страну — от
    // числа жителей до порядка подписи на карте, и хранить их незачем.
    const features = raw.features
        .map((f) => ({
            type: "Feature",
            properties: {
                iso: f.properties.ISO_A2_EH && f.properties.ISO_A2_EH !== "-99"
                    ? f.properties.ISO_A2_EH
                    : f.properties.ISO_A2,
                name: f.properties.NAME_RU || f.properties.NAME,
            },
            geometry: f.geometry,
        }))
        .filter((f) => f.properties.iso && f.properties.iso !== "-99");

    writeFileSync(file, JSON.stringify({ type: "FeatureCollection", features }));
    console.log(`  сохранено границ: ${features.length}`);
    return features as CountryFeature[];
};

const main = async () => {
    const write = process.argv.includes("--write");

    const file = path.join(process.cwd(), "script-data", "countries.geojson");
    const countries = await ensureBoundaries(file);
    console.log(`границ загружено: ${countries.length}`);

    // Рамка страны считается один раз: проверка по рамке отсекает почти все
    // страны за одно сравнение, и без неё на каждую точку пришлось бы обходить
    // все контуры мира.
    const boxes = countries.map((c) => {
        const polys = c.geometry.type === "Polygon"
            ? [c.geometry.coordinates as number[][][]]
            : (c.geometry.coordinates as number[][][][]);
        let minX = 180, minY = 90, maxX = -180, maxY = -90;
        for (const poly of polys) for (const [x, y] of poly[0]) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        return { iso: c.properties.iso, name: c.properties.name, polys, minX, minY, maxX, maxY };
    });

    const countryAt = (lon: number, lat: number): string | null => {
        for (const c of boxes) {
            if (lon < c.minX || lon > c.maxX || lat < c.minY || lat > c.maxY) continue;
            if (c.polys.some((poly) => inPolygon(poly, lon, lat))) return c.iso;
        }
        return null;
    };

    const db = (await clientPromise).db("typikon");
    const temples = db.collection("temples");
    const all = await temples.find({}, {
        projection: { slug: 1, latitude: 1, longitude: 1, country: 1, denomination: 1, church: 1, churchSource: 1 },
    }).toArray();
    console.log(`храмов: ${all.length}`);

    const byCountry = new Map<string, number>();
    const byChurch = new Map<string, number>();
    let filled = 0, kept = 0, lost = 0, churched = 0;

    for (const t of all as any[]) {
        // Страну, сказанную источником, не трогаем: она точнее вывода по контуру.
        const country = t.country ?? countryAt(t.longitude, t.latitude);
        if (!country) { lost++; continue; }
        if (t.country) kept++; else filled++;
        byCountry.set(country, (byCountry.get(country) ?? 0) + 1);

        const resolved = resolveChurch(t.denomination, country);
        if (resolved.church) {
            byChurch.set(resolved.church, (byChurch.get(resolved.church) ?? 0) + 1);
            churched++;
        }
        if (!write) continue;

        await temples.updateOne({ _id: t._id }, {
            $set: {
                country,
                church: resolved.church,
                churchSource: resolved.churchSource,
                ustav: resolved.ustav,
            },
        });
    }

    console.log(`  страна выведена по точке: ${filled}; была в источнике: ${kept}; не определилась: ${lost}`);
    console.log(`  Церковь известна у ${churched}`);
    console.log("  по странам: " + [...byCountry].sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([k, n]) => `${k} ${n}`).join(", "));
    console.log("  по Церквам: " + [...byChurch].sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`).join(", "));
    if (!write) console.log("\nпробный прогон; чтобы записать — --write");
};

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
