// Православные храмы мира из OpenStreetMap.
//
// ПОЧЕМУ OSM СТАЛ ОСНОВНЫМ ИСТОЧНИКОМ. Замер по миру: в OSM 70 122 объекта с
// исповеданием православным, в Wikidata с явной пометкой православия — 3 532.
// Вшестеро больше, чем вся русская выборка Wikidata, и притом по всему свету,
// а не по одной стране. Wikidata остаётся источником года постройки, охранного
// статуса и ссылок — того, чего в OSM нет.
//
// ИСПОВЕДАНИЕ В OSM — ЭТО ЮРИСДИКЦИЯ. Метка стоит не «православный вообще», а
// `russian_orthodox`, `greek_orthodox`, `serbian_orthodox` и так далее: её
// ставит человек, глядя на храм. Отсюда и берётся Церковь, а из Церкви —
// устав, по которому храму собирать службу (@/utils/jurisdictions).
//
// ПРЕСТОЛА ПОЛЕМ НЕТ И ЗДЕСЬ. Теги `church:dedication` и `dedication` на весь
// мир стоят у четырёх объектов из семидесяти тысяч. Значит престол по-прежнему
// читается из имени словарём — и словарю нужны языки: греческий, румынский,
// сербский, грузинский. Пока разбирается только кириллическое имя, и это
// видно в отчёте.
//
// ЗАПРАШИВАЕМ ПО ЧАСТЯМ. Один запрос на семьдесят тысяч Overpass отдаёт
// минутами и рвётся по таймауту; по метке исповедания выходит полтора десятка
// запросов поменьше, каждый со своим отступом при отказе.
//
// Запуск:  npm run temples:import-osm [-- --write] [-- --only greek_orthodox,serbian_orthodox]
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { slugify, uniqueAlias } from "@/lib/news/format";
import { resolveChurch } from "@/utils/jurisdictions";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const UA = "typikon-web/1.0 (temples import, contact: georgecarpow@gmail.com)";

/** Метки исповедания, которые считаем православными. Список закрытый нарочно. */
const DENOMINATIONS = [
    "orthodox", "russian_orthodox", "greek_orthodox", "serbian_orthodox",
    "romanian_orthodox", "bulgarian_orthodox", "georgian_orthodox",
    "ukrainian_orthodox", "belarusian_orthodox", "macedonian_orthodox",
    "coptic_orthodox", "ethiopian_orthodox", "armenian_apostolic", "syriac_orthodox",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OsmElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

const overpass = async (query: string, retries = 4): Promise<OsmElement[]> => {
    const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: new URLSearchParams({ data: query }),
    });
    if ([429, 502, 503, 504].includes(res.status)) {
        if (retries <= 0) throw new Error(`Overpass ${res.status}: попытки исчерпаны`);
        // Overpass просит подождать дольше, чем принято: у него очередь на
        // несколько слотов, и частым повтором мы её только занимаем.
        const wait = 60_000;
        console.log(`  ${res.status}; жду минуту и повторяю (осталось попыток: ${retries})`);
        await sleep(wait);
        return overpass(query, retries - 1);
    }
    if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 200)}`);

    // ОБРЕЗАННЫЙ ОТВЕТ ПРИХОДИТ С КОДОМ 200. Overpass, не уложившись, рвёт
    // выдачу посреди строки и закрывает соединение — для fetch это успех, и
    // спотыкается всё на JSON.parse. Разбираем текстом, чтобы отличить эту
    // беду от испорченного запроса: первую лечит повтор и дробление, вторую
    // нет, и путать их значит повторять бессмысленно.
    const body = await res.text();
    try {
        return (JSON.parse(body).elements ?? []) as OsmElement[];
    } catch {
        if (retries <= 0) {
            throw new Error("Overpass вернул обрезанный ответ; попытки исчерпаны");
        }
        console.log(`  ответ обрезан (${body.length} байт); жду минуту и повторяю`);
        await sleep(60_000);
        return overpass(query, retries - 1);
    }
};

/**
 * Тот же запрос, но по частям, когда целиком он не уезжает.
 *
 * Дробим ПО ТИПУ ОБЪЕКТА, а не по площади: тип есть у всякого элемента, и
 * три запроса вместо одного дают три ответа втрое короче. Деление же по
 * квадратам потребовало бы знать, где эти храмы, — а мы за тем и идём.
 */
const overpassByType = async (selector: string): Promise<OsmElement[]> => {
    const out: OsmElement[] = [];
    for (const type of ["node", "way", "relation"]) {
        const part = await overpass(
            `[out:json][timeout:250];\n${type}${selector};\nout center tags;`);
        console.log(`    ${type}: ${part.length}`);
        out.push(...part);
        await sleep(2000);
    }
    return out;
};

/** Тип постройки по тегам, а не по имени: в OSM он размечен полем. */
// КОНТАКТЫ ПРИХОДА. Теги мы и так запрашиваем все («out center tags»), а
// сохраняли из них одно имя с местом — и оттого не могли проверить ни одной
// заявки на ведение расписания: кто заявляет храм своим, тому нечего было
// предъявить, а нам нечего сверить.
//
// Сайт прихода — единственный признак, проверяемый машиной: кто может
// положить на него наш знак, тот и приход. По данным OSM он есть у пяти
// процентов православных храмов (1362 из 26022) — путь побочный, но
// настоящий, и приходы эти самые живые.
//
// Телефон и почта машиной не проверяются и лежат для человека: модератор
// звонит и решает сам.
//
// ЧИСТИМ, НО НЕ ДОДУМЫВАЕМ: адрес без схемы получает https, потому что без
// неё это не ссылка вовсе; всё прочее берётся как напечатано. Правка чужих
// данных — не наше дело, и молча «поправленный» телефон хуже кривого.
const trimmed = (v?: string) => {
    const s = (v ?? "").trim();
    return s && s.length <= 200 ? s : null;
};

const siteOf = (v?: string) => {
    const s = trimmed(v);
    if (!s) return null;
    const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    try { return new URL(url).toString(); } catch { return null; }
};

const contactsOf = (tags: Record<string, string>) => {
    const website = siteOf(tags.website ?? tags["contact:website"] ?? tags.url);
    const phone = trimmed(tags.phone ?? tags["contact:phone"]);
    const email = trimmed(tags.email ?? tags["contact:email"]);
    return {
        website, phone, email,
        // откуда взято — чтобы отличить наше от чужого, когда приход поправит
        // свои контакты сам
        contactsSource: website || phone || email ? "osm" : null,
    };
};

const kindOf = (tags: Record<string, string>): string => {
    if (tags.building === "chapel" || tags.church === "chapel" || /часовн|chapel|parekklisi/i.test(tags.name ?? "")) return "chapel";
    if (tags.building === "cathedral" || /собор|cathedral|katedral/i.test(tags.name ?? "")) return "cathedral";
    if (tags.amenity === "monastery" || tags.building === "monastery" || /монастыр|monaster|manastir|μονή/i.test(tags.name ?? "")) return "monastery";
    return "church";
};

/**
 * Имя, по которому разбирается престол. Берём русское, когда оно есть: словарь
 * посвящений написан по-русски, и греческое «Άγιος Νικόλαος» ему пока немо.
 */
const nameFor = (tags: Record<string, string>) =>
    tags["name:ru"] || tags.name || tags["name:en"] || null;

const main = async () => {
    const argv = process.argv;
    const write = argv.includes("--write");
    // Списком, а не по одной: привоз рвётся посередине (сеть, очередь
    // Overpass), и доводить его до конца по одной метке — значит держать в
    // голове, какие уже забраны.
    const only = argv.includes("--only")
        ? argv[argv.indexOf("--only") + 1].split(",").map((d) => d.trim()).filter(Boolean)
        : null;

    const db = (await clientPromise).db("typikon");
    const temples = db.collection("temples");
    await temples.createIndex({ osmId: 1 }, { unique: true, sparse: true });
    await temples.createIndex({ country: 1 });
    await temples.createIndex({ church: 1 });

    const known = await temples.find({}, { projection: { slug: 1, osmId: 1, wikidataId: 1 } }).toArray();
    const taken = new Set(known.map((t: any) => t.slug).filter(Boolean) as string[]);
    const slugByOsm = new Map(known.filter((t: any) => t.osmId).map((t: any) => [t.osmId, t.slug]));
    // Сведение с уже привезённым: у части объектов OSM проставлен ключ
    // Wikidata, и это единственная НАДЁЖНАЯ склейка. По близости точек не
    // сводим: два храма в одной ограде стоят в тридцати метрах друг от друга.
    //
    // Список ПОПОЛНЯЕТСЯ ПО ХОДУ, а не снимается один раз в начале. Один храм
    // в OSM размечен и точкой, и контуром здания, и оба объекта несут один и
    // тот же ключ Wikidata. Со снимком начала второй такой объект не находил
    // первого — тот был заведён только что, — и пытался завести двойника с уже
    // занятым ключом. На этом прогон и обрывался.
    const byWikidata = new Map<string, any>(
        known.filter((t: any) => t.wikidataId).map((t: any) => [t.wikidataId, t]));

    let created = 0, merged = 0, skipped = 0;
    const byCountry = new Map<string, number>();
    const byChurch = new Map<string, number>();
    let cyrillic = 0, other = 0;

    for (const denomination of only ?? DENOMINATIONS) {
        const selector = `["amenity"="place_of_worship"]["denomination"="${denomination}"]`;
        console.log(`\n${denomination}…`);
        let elements: OsmElement[];
        try {
            elements = await overpass(
                `[out:json][timeout:250];\nnwr${selector};\nout center tags;`);
        } catch (e) {
            // Крупные разряды («orthodox» — двадцать шесть тысяч объектов)
            // целиком не уезжают; тогда берём их по частям
            console.log(`  целиком не вышло (${(e as Error).message}); беру по частям`);
            elements = await overpassByType(selector);
        }
        console.log(`  объектов: ${elements.length}`);

        for (const el of elements) {
            const tags = el.tags ?? {};
            const name = nameFor(tags);
            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;
            // Без имени и точки объект бесполезен: ни престола, ни карты.
            if (!name || lat === undefined || lon === undefined) { skipped++; continue; }

            const osmId = `${el.type}/${el.id}`;
            const country = tags["addr:country"] ?? tags["is_in:country_code"] ?? null;
            const { church, churchSource, ustav } = resolveChurch(denomination, country);

            if (/[а-яё]/i.test(name)) cyrillic++; else other++;
            if (country) byCountry.set(country, (byCountry.get(country) ?? 0) + 1);
            if (church) byChurch.set(church, (byChurch.get(church) ?? 0) + 1);

            if (!write) continue;

            // Тот же храм из Wikidata — дополняем его, а не заводим двойника.
            const twin = tags.wikidata ? byWikidata.get(tags.wikidata) : undefined;
            const fields = {
                osmId, denomination, church, churchSource, ustav,
                ...(country ? { country } : {}),
                updatedAt: new Date(),
            };

            if (twin) {
                // Дополняем чужую запись, а не переписываем её: год постройки
                // и охранный статус у Wikidata точнее, имя — каноничнее.
                await temples.updateOne(
                    twin._id ? { _id: twin._id } : { wikidataId: tags.wikidata },
                    { $set: fields });
                merged++;
                continue;
            }

            const slug = slugByOsm.get(osmId)
                ?? uniqueAlias(slugify(tags["addr:city"] ? `${name} ${tags["addr:city"]}` : name), taken);
            if (!slugByOsm.has(osmId)) { taken.add(slug); created++; }

            const inserted = await temples.updateOne({ osmId }, {
                $set: {
                    name, kind: kindOf(tags),
                    place: tags["addr:city"] ?? tags["addr:place"] ?? null,
                    ...contactsOf(tags),
                    latitude: lat, longitude: lon,
                    location: { type: "Point", coordinates: [lon, lat] },
                    source: "osm",
                    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
                    ...(tags.wikidata ? { wikidataId: tags.wikidata } : {}),
                    ...fields,
                },
                $setOnInsert: { slug, prestoly: [], createdAt: new Date() },
            }, { upsert: true });

            // Заведённую запись сразу заносим в список: следующий объект того
            // же храма должен найти её, а не создавать второй.
            if (tags.wikidata) {
                byWikidata.set(tags.wikidata, { _id: inserted.upsertedId ?? null, wikidataId: tags.wikidata });
            }
        }
    }

    console.log(`\nновых: ${created}; дополнено к записям Wikidata: ${merged}; без имени или точки: ${skipped}`);
    console.log(`имя кириллицей (словарь его читает): ${cyrillic}; иным письмом: ${other}`);
    console.log("по Церквам: " + [...byChurch].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", "));
    console.log("по странам (первые 15): " + [...byCountry].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `${k} ${n}`).join(", "));
    if (!write) console.log("\nпробный прогон; чтобы записать — --write");
};

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
