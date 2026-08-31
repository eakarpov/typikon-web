// Храмы России из Wikidata в каталог `temples`.
//
// ПОЧЕМУ ИМЕННО ОТТУДА. Списки храмов с престолами есть в трёх местах, и
// условия у них разные. Wikidata — CC0, то есть брать можно без оговорок, и
// в ней 11 763 храма России с координатами, у 8 555 проставлен год постройки.
// OSM берётся следом отдельным скриптом (ODbL, с указанием источника). На
// sobory.ru престолы выписаны явно и объектов вдвое больше, но материалы там
// авторские — оттуда только ссылка, никакого импорта.
//
// ПРЕСТОЛА В ВЫГРУЗКЕ НЕТ. Поле «назван в честь» (P138) заполнено у 979 храмов
// из 11 763; у остальных посвящение спрятано в названии («Никольская церковь»,
// «Церковь Илии Пророка»). Разбирает его отдельный скрипт по словарю
// (@/utils/dedications, match-temple-dedications.ts) — здесь только привоз.
//
// ЗАПРОС РАЗБИТ НЕ ПО ЛЕНИ. Всё нужное одним запросом взять не выходит: стоит
// добавить к нему P31 или P1435, как число строк множится на каждое значение
// свойства, и служба отвечает 502 на 240-й секунде (проверено). Поэтому
// основной запрос беден нарочно, а тип храма выводится из названия — русское
// имя его и так называет: «Часовня…», «Собор…».
//
// АДРЕС ДАЁТСЯ ОДИН РАЗ. Слуг записи не меняется при повторных прогонах, даже
// если в Wikidata поправят название: адрес — обещание, и переименование
// объекта не повод его ломать (то же правило, что у святых, см.
// assign-saint-slugs.ts).
//
// Запуск:  npm run temples:import-wikidata [-- --write] [-- --limit 200]
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { slugify, uniqueAlias } from "@/lib/news/format";

const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "typikon-web/1.0 (temples import, contact: georgecarpow@gmail.com)";

const QUERY = `
SELECT ?item ?label ?year ?lat ?lon ?place WHERE {
  ?item wdt:P31/wdt:P279* wd:Q16970 ; wdt:P17 wd:Q159 .
  ?item p:P625/psv:P625 ?cn . ?cn wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .
  ?item rdfs:label ?label . FILTER(lang(?label)="ru")
  OPTIONAL { ?item wdt:P571 ?inc . BIND(YEAR(?inc) AS ?year) }
  OPTIONAL { ?item wdt:P131 ?p . ?p rdfs:label ?place . FILTER(lang(?place)="ru") }
}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = Record<string, { value: string } | undefined>;

/**
 * Запрос с отступом. 502 здесь такой же рабочий ответ, как 429: служба
 * отвечает им, когда запрос не уложился в её собственный предел, и на
 * двенадцати тысячах строк это случается регулярно.
 */
const sparql = async (query: string, retries = 4): Promise<Row[]> => {
    const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/sparql-results+json", "User-Agent": UA },
    });
    if ([429, 500, 502, 503, 504].includes(res.status)) {
        if (retries <= 0) throw new Error(`SPARQL ${res.status}: попытки исчерпаны`);
        const wait = (Number(res.headers.get("retry-after")) || 15) * 1000;
        console.log(`  ${res.status}; жду ${wait / 1000} с и повторяю (осталось попыток: ${retries})`);
        await sleep(wait);
        return sparql(query, retries - 1);
    }
    if (!res.ok) throw new Error(`SPARQL ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()).results.bindings as Row[];
};

/**
 * Тип постройки по названию. Не украшение: часовня — не храм, престола у неё
 * может не быть вовсе, и в подвязке к уставу ей делать нечего.
 *
 * «Колокольня», «корпус», «часовня-столп» — это вообще не молитвенные здания,
 * а части ансамбля, попавшие в выгрузку заодно. Их метим отдельно, чтобы
 * указатель мог их не показывать, а счёт по посвящениям — не считать.
 */
const kindOf = (label: string): string => {
    const s = label.toLowerCase();
    if (/колокольн|корпус|ограда|ворота|усыпальниц|музей|планетари|руин/.test(s)) return "not-temple";
    if (/часовн/.test(s)) return "chapel";
    if (/собор/.test(s)) return "cathedral";
    if (/монастыр|лавр|пустын|скит/.test(s)) return "monastery";
    return "church";
};

const main = async () => {
    const argv = process.argv;
    const write = argv.includes("--write");
    const limit = Number(argv[argv.indexOf("--limit") + 1]) || 0;

    console.log("спрашиваю Wikidata…");
    const rows = await sparql(limit ? `${QUERY} LIMIT ${limit}` : QUERY);
    console.log(`строк в ответе: ${rows.length}`);

    // Строк больше, чем храмов: у объекта бывает несколько P131 (район и
    // город разом). Сводим по идентификатору, а не полагаемся на DISTINCT —
    // выбрать из двух названий места нужно самое частное, а это уже разбор.
    const byId = new Map<string, { id: string; label: string; year: number | null; lat: number; lon: number; places: string[] }>();
    for (const r of rows) {
        const id = r.item!.value.split("/").pop()!;
        const existing = byId.get(id);
        const place = r.place?.value;
        if (existing) {
            if (place && !existing.places.includes(place)) existing.places.push(place);
            continue;
        }
        byId.set(id, {
            id,
            label: r.label!.value,
            year: r.year ? Number(r.year.value) : null,
            lat: Number(r.lat!.value),
            lon: Number(r.lon!.value),
            places: place ? [place] : [],
        });
    }
    console.log(`храмов после сведения: ${byId.size}`);

    const db = (await clientPromise).db("typikon");
    const temples = db.collection("temples");
    await temples.createIndex({ wikidataId: 1 }, { unique: true, sparse: true });
    await temples.createIndex({ slug: 1 }, { unique: true });
    await temples.createIndex({ location: "2dsphere" });

    const known = await temples.find({}, { projection: { slug: 1, wikidataId: 1 } }).toArray();
    const taken = new Set(known.map((t: any) => t.slug).filter(Boolean) as string[]);
    const slugByWikidata = new Map(known.filter((t: any) => t.wikidataId).map((t: any) => [t.wikidataId, t.slug]));

    const kinds = new Map<string, number>();
    let created = 0, updated = 0;

    // Устойчивый порядок: одинаковых имён много («Никольская церковь»), и
    // второму достаётся «-2». Пусть этот номер не переезжает между прогонами.
    for (const t of [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))) {
        const kind = kindOf(t.label);
        kinds.set(kind, (kinds.get(kind) ?? 0) + 1);

        // Место — самое частное из названных: «Петроградский район» точнее,
        // чем «Санкт-Петербург», и в указателе полезнее.
        const place = t.places.length ? t.places[t.places.length - 1] : null;

        let slug = slugByWikidata.get(t.id);
        if (!slug) {
            const base = slugify(place ? `${t.label} ${place}` : t.label);
            slug = uniqueAlias(base, taken);
            taken.add(slug);
            created++;
        } else {
            updated++;
        }

        if (!write) continue;
        await temples.updateOne(
            { wikidataId: t.id },
            {
                $set: {
                    name: t.label, kind, place, year: t.year,
                    latitude: t.lat, longitude: t.lon,
                    // GeoJSON — ради индекса 2dsphere: «храмы рядом со мной»
                    // иначе пришлось бы считать перебором всей выборки.
                    location: { type: "Point", coordinates: [t.lon, t.lat] },
                    source: "wikidata",
                    sourceUrl: `https://www.wikidata.org/wiki/${t.id}`,
                    updatedAt: new Date(),
                },
                $setOnInsert: { slug, wikidataId: t.id, prestoly: [], createdAt: new Date() },
            },
            { upsert: true });
    }

    console.log(`  новых: ${created}; уже известных: ${updated}`);
    console.log("  по типу: " + [...kinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", "));
    if (!write) console.log("\nпробный прогон; чтобы записать — --write");
};

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
