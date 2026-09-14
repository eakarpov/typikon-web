// Запросы к Wikidata Query Service для скриптов привоза (храмы, места).
//
// Запрос с отступом: 429 и 502 здесь такие же рабочие ответы, как 200 — служба
// отвечает ими, когда запрос не уложился в её собственный предел, и на тысячах
// строк это случается регулярно. Запрос уходит POST-ом: списки VALUES на сотни
// элементов в адрес GET не помещаются.

export const ENDPOINT = "https://query.wikidata.org/sparql";
export const USER_AGENT = "typikon-web/1.0 (data import, contact: georgecarpow@gmail.com)";

export type Row = Record<string, { value: string; "xml:lang"?: string } | undefined>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const sparql = async (query: string, retries = 4): Promise<Row[]> => {
    const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
            Accept: "application/sparql-results+json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({ query }),
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

/** «http://www.wikidata.org/entity/Q87» → «Q87». */
export const qidOf = (uri: string | undefined) => uri?.split("/").pop();

/** Список по частям: VALUES на тысячу элементов служба не переваривает за отпущенное время. */
export const chunks = <T>(items: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
