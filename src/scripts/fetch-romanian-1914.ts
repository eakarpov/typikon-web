// Привоз румынской Синодальной Библии 1914 года из Викитеки.
//
// ЗАЧЕМ. Румынская кириллица 1688 года — наш собственный набор со сканов, и читать
// её умеет не всякий, кто читает по-румынски. Синодальное издание 1914 года —
// прямая наследница той же традиции, латиницей, и рядом с кириллицей встаёт
// подложкой: видно, что стоит в стихе, не разбирая полуустава.
//
// ОТКУДА. ro.wikisource.org/wiki/Biblia_1914 — вычитанный людьми текст, CC BY-SA 4.0.
// НЕ archive.org: там то же издание лежит сырым OCR (Tesseract), а этот урок мы уже
// прошли с греческим, где невычитанная оцифровка дала шесть тысяч описок.
//
// РАЗМЕТКА ВИКИ УДОБНА: глава — «==CAP. N.==», стих — якорь «<span id="глава.стих"/>».
// Поэтому разбор идёт по якорям, а не по нумерации в тексте: номер в тексте иногда
// отсутствует (у первого стиха главы) и иногда сбит, а якорь ставился разметчиком.
//
// КНИГИ СОПОСТАВЛЯЮТСЯ ПО ИМЕНИ, А НЕ ПО ПОРЯДКУ. У 1914-го малые пророки идут
// западным порядком (Иоиль перед Амосом), у 1688-го — греческим (Амос перед Иоилем).
// Сопоставление по позиции молча положило бы текст Иоиля под Амоса.
//
// Запуск (нужен доступ в сеть):
//   npx tsx src/scripts/fetch-romanian-1914.ts
//   npx tsx src/scripts/fetch-romanian-1914.ts --out romanian/ro-1914.json
//
// Дальше — общим импортёром:
//   npx tsx src/scripts/import-bible-edition.ts romanian/ro-1914.json --apply
import "@/scripts/lib/env";
import fs from "fs";
import path from "path";
import { BIBLE_CANON } from "@/utils/bibleCanon";

const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? process.argv[outArg + 1] : "romanian/ro-1914.json";
const BASE = "https://ro.wikisource.org/wiki/Biblia_1914";

interface BookPlan {
    /** Имя подстраницы в Викитеке. */
    page: string;
    /** Слуг книги издания — тот же, что у румынской 1688: это одна традиция. */
    slug: string;
    /** Куда книга ложится в каноне. */
    canonId: string;
    name: string;
}

/**
 * Книги издания. Слуги и привязка к канону взяты у ro-1688 — там эта работа уже
 * сделана, и совпадение слугов держит обе румынские колонки в одном ряду.
 */
const BOOKS: BookPlan[] = [
    { page: "Facerea", slug: "bytie", canonId: "bytie", name: "Facerea" },
    { page: "Eșirea", slug: "iskhod", canonId: "iskhod", name: "Eșirea" },
    { page: "Leviticul", slug: "levit", canonId: "levit", name: "Leviticul" },
    { page: "Numerii", slug: "chisla", canonId: "chisla", name: "Numerii" },
    { page: "A doua lege", slug: "vtorozakonie", canonId: "vtorozakonie", name: "A doua lege" },
    { page: "Isus Navì", slug: "iisus-navin", canonId: "iisus-navin", name: "Isus Navì" },
    { page: "Judecătorii", slug: "sudi", canonId: "sudi", name: "Judecătorii" },
    { page: "Rut", slug: "ruf", canonId: "ruf", name: "Rut" },
    { page: "1 Împărați", slug: "1-tsarstv", canonId: "1-tsarstv", name: "1 Împărați" },
    { page: "2 Împărați", slug: "2-tsarstv", canonId: "2-tsarstv", name: "2 Împărați" },
    { page: "3 Împărați", slug: "3-tsarstv", canonId: "3-tsarstv", name: "3 Împărați" },
    { page: "4 Împărați", slug: "4-tsarstv", canonId: "4-tsarstv", name: "4 Împărați" },
    { page: "1 Paralipomene", slug: "1-paralipomenon", canonId: "1-paralipomenon", name: "1 Paralipomene" },
    { page: "2 Paralipomene", slug: "2-paralipomenon", canonId: "2-paralipomenon", name: "2 Paralipomene" },
    { page: "Esdra", slug: "1-ezdry", canonId: "1-ezdry", name: "Esdra" },
    { page: "Neemia", slug: "neemii", canonId: "neemii", name: "Neemia" },
    { page: "Estir", slug: "esfir", canonId: "esfir", name: "Estir" },
    { page: "Iov", slug: "iova", canonId: "iova", name: "Iov" },
    { page: "Psaltirea", slug: "psaltir", canonId: "psaltir", name: "Psaltirea" },
    { page: "Pilde", slug: "pritchi", canonId: "pritchi", name: "Pildele lui Solomon" },
    { page: "Eclisiastul", slug: "ekklesiast", canonId: "ekklesiast", name: "Eclisiastul" },
    { page: "Cântarea cântărilor", slug: "pesn-pesney", canonId: "pesn-pesney", name: "Cântarea cântărilor" },
    { page: "Isaia", slug: "isaii", canonId: "isaii", name: "Isaia" },
    { page: "Ieremia", slug: "ieremii", canonId: "ieremii", name: "Ieremia" },
    { page: "Plângerile Ieremiei", slug: "plach-ieremii", canonId: "plach-ieremii", name: "Plângerile Ieremiei" },
    { page: "Iezechiil", slug: "iezekiilya", canonId: "iezekiilya", name: "Iezechiil" },
    { page: "Daniil", slug: "daniila", canonId: "daniila", name: "Daniil" },
    { page: "Osie", slug: "osii", canonId: "osii", name: "Osie" },
    { page: "Ioil", slug: "ioilya", canonId: "ioilya", name: "Ioil" },
    { page: "Amos", slug: "amosa", canonId: "amosa", name: "Amos" },
    { page: "Avdie", slug: "avdiya", canonId: "avdiya", name: "Avdie" },
    { page: "Ionà", slug: "iony", canonId: "iony", name: "Ionà" },
    { page: "Miheea", slug: "mikheya", canonId: "mikheya", name: "Miheea" },
    { page: "Naum", slug: "nauma", canonId: "nauma", name: "Naum" },
    { page: "Avacum", slug: "avvakuma", canonId: "avvakuma", name: "Avacum" },
    { page: "Sofonie", slug: "sofonii", canonId: "sofonii", name: "Sofonie" },
    { page: "Agheu", slug: "aggeya", canonId: "aggeya", name: "Agheu" },
    { page: "Zaharia", slug: "zakharii", canonId: "zakharii", name: "Zaharia" },
    { page: "Malahia", slug: "malakhii", canonId: "malakhii", name: "Malahia" },
    { page: "Tovit", slug: "tovita", canonId: "tovita", name: "Tovit" },
    { page: "Iudita", slug: "iudifi", canonId: "iudifi", name: "Iudita" },
    { page: "Varuh", slug: "varukha", canonId: "varukha", name: "Varuh" },
    { page: "Cartea Ieremiei", slug: "poslanie-ieremii", canonId: "poslanie-ieremii", name: "Cartea lui Ieremia prorocul" },
    // Три книги, которые славянская Библия держит внутри Даниила. Слуги те же, что
    // у 1688-го; правила согласования уводят их в 13-ю, 14-ю главы и в песнь.
    { page: "Cântarea celor trei tineri", slug: "pesn-trekh-otrokov", canonId: "daniila", name: "Cântarea celor trei tineri" },
    { page: "3 Esdra", slug: "2-ezdry", canonId: "2-ezdry", name: "Cartea a treia a lui Esdra" },
    { page: "Înțelepciunea lui Solomon", slug: "premudrosti-solomona", canonId: "premudrosti-solomona", name: "Înțelepciunea lui Solomon" },
    { page: "Sirah", slug: "sirakha", canonId: "sirakha", name: "Sirah" },
    { page: "Susana", slug: "susanny", canonId: "daniila", name: "Istoria Susanei" },
    { page: "Istoria omorîrei balaurului și a sfărâmării lui Vil", slug: "vil-i-drakon", canonId: "daniila", name: "Istoria balaurului și a lui Vil" },
    { page: "1 Macavei", slug: "1-makkaveyskaya", canonId: "1-makkaveyskaya", name: "1 Macavei" },
    { page: "2 Macavei", slug: "2-makkaveyskaya", canonId: "2-makkaveyskaya", name: "2 Macavei" },
    { page: "3 Macavei", slug: "3-makkaveyskaya", canonId: "3-makkaveyskaya", name: "3 Macavei" },
    // Славянская Библия не держит её книгой — только двенадцатой песнью библейской.
    { page: "Rugăciunea lui Manasì", slug: "molitva-manassii", canonId: "molitva-manassii", name: "Rugăciunea lui Manasì" },
    { page: "Matei", slug: "matfeya", canonId: "matfeya", name: "Matei" },
    { page: "Marcu", slug: "marka", canonId: "marka", name: "Marcu" },
    { page: "Luca", slug: "luki", canonId: "luki", name: "Luca" },
    { page: "Ioan", slug: "ioanna", canonId: "ioanna", name: "Ioan" },
    { page: "Faptele Apostolilor", slug: "deyaniya", canonId: "deyaniya", name: "Faptele Apostolilor" },
    { page: "Romani", slug: "rimlyanam", canonId: "rimlyanam", name: "Romani" },
    { page: "1 Corinteni", slug: "1-korinfyanam", canonId: "1-korinfyanam", name: "1 Corinteni" },
    { page: "2 Corinteni", slug: "2-korinfyanam", canonId: "2-korinfyanam", name: "2 Corinteni" },
    { page: "Galateni", slug: "galatam", canonId: "galatam", name: "Galateni" },
    { page: "Efeseni", slug: "efesyanam", canonId: "efesyanam", name: "Efeseni" },
    { page: "Filippiseni", slug: "filippiytsam", canonId: "filippiytsam", name: "Filippiseni" },
    { page: "Colaseni", slug: "kolossyanam", canonId: "kolossyanam", name: "Colaseni" },
    { page: "1 Tesalonicheni", slug: "1-fessaloniyitsam", canonId: "1-fessaloniyitsam", name: "1 Tesalonicheni" },
    { page: "2 Tesalonicheni", slug: "2-fessaloniyitsam", canonId: "2-fessaloniyitsam", name: "2 Tesalonicheni" },
    { page: "1 Timotei", slug: "1-timofeyu", canonId: "1-timofeyu", name: "1 Timotei" },
    { page: "2 Timotei", slug: "2-timofeyu", canonId: "2-timofeyu", name: "2 Timotei" },
    { page: "Tit", slug: "titu", canonId: "titu", name: "Tit" },
    { page: "Filimon", slug: "filimonu", canonId: "filimonu", name: "Filimon" },
    { page: "Evrei", slug: "evreyam", canonId: "evreyam", name: "Evrei" },
    { page: "Iacov", slug: "iakova", canonId: "iakova", name: "Iacov" },
    { page: "1 Petru", slug: "1-petra", canonId: "1-petra", name: "1 Petru" },
    { page: "2 Petru", slug: "2-petra", canonId: "2-petra", name: "2 Petru" },
    { page: "1 Ioan", slug: "1-ioanna-posl", canonId: "1-ioanna-posl", name: "1 Ioan" },
    { page: "2 Ioan", slug: "2-ioanna-posl", canonId: "2-ioanna-posl", name: "2 Ioan" },
    { page: "3 Ioan", slug: "3-ioanna-posl", canonId: "3-ioanna-posl", name: "3 Ioan" },
    { page: "Iuda", slug: "iudy", canonId: "iudy", name: "Iuda" },
    { page: "Apocalipsis", slug: "otkrovenie", canonId: "otkrovenie", name: "Apocalipsis" },
];

const NT_SECTIONS = new Set(["gospel", "apostle", "revelation"]);
const canonOrder = new Map(BIBLE_CANON.map((book, index) => [book.id, index + 1]));
const canonSection = new Map(BIBLE_CANON.map((book) => [book.id, book.section]));

/** Викиразметка -> голый текст стиха. */
const plain = (raw: string) => raw
    // Сноски на параллельные места живут отдельным блоком — они не часть стиха.
    .replace(/<div[\s\S]*?<\/div>/g, " ")
    .replace(/<ref[\s\S]*?<\/ref>/g, " ")
    // Заголовки разделов («Facerea lumii.») набраны по центру и стоят МЕЖДУ главами:
    // они попадают в кусок, который идёт за последним стихом предыдущей главы.
    .replace(/<center>[\s\S]*?<\/center>/g, " ")
    .replace(/<[^>]+>/g, " ")
    // [[ссылка|подпись]] -> подпись, [[ссылка]] -> ссылка
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/'''?/g, "")
    // Номер стиха, продублированный в самом тексте: «2. Și pământul…»
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

const fetchPage = async (page: string): Promise<string> => {
    const url = `${BASE}/${encodeURIComponent(page.replace(/ /g, "_"))}?action=raw`;
    const response = await fetch(url, {
        headers: { "User-Agent": "typikon.su corpus import (contact: typikon.su/contact)" },
    });
    if (!response.ok) throw new Error(`${page}: ${response.status}`);
    return response.text();
};

/** Стихи книги по якорям «<span id="глава.стих"/>». */
const parse = (wikitext: string) => {
    const chapters: Record<string, Record<string, string>> = {};
    const anchor = /<span id="(\d+)\.(\d+)"\s*\/?>/g;

    const marks: Array<{ chapter: string; verse: string; at: number; end: number }> = [];
    let m = anchor.exec(wikitext);
    while (m) {
        marks.push({ chapter: m[1], verse: m[2], at: m.index, end: m.index + m[0].length });
        m = anchor.exec(wikitext);
    }

    marks.forEach((mark, index) => {
        const till = index + 1 < marks.length ? marks[index + 1].at : wikitext.length;
        let slice = wikitext.slice(mark.end, till);

        // Стих кончается там, где начинается заголовок главы. Без этого последний
        // стих каждой главы утаскивал за собой «==CAP. 2.==» и название следующего
        // раздела: они стоят между главами и попадают в тот же кусок.
        const heading = slice.search(/\n\s*==/);
        if (heading >= 0) slice = slice.slice(0, heading);

        const text = plain(slice);
        if (!text) return;
        chapters[mark.chapter] = chapters[mark.chapter] || {};
        chapters[mark.chapter][mark.verse] = text;
    });

    // Молитва Манассии напечатана СПЛОШНЫМ текстом: это одна молитва, издание её не
    // нумерует, и якорей на странице нет ни одного. Кладём целиком одним стихом —
    // так, как она и напечатана, а не дробим по своему усмотрению.
    if (!marks.length) {
        const body = plain(wikitext.replace(/^\{\{titlu[\s\S]*?\n\}\}/, ""));
        if (body) chapters["1"] = { "1": body };
    }

    return chapters;
};

const main = async () => {
    const books = [];
    let verses = 0;

    for (const plan of BOOKS) {
        const wikitext = await fetchPage(plan.page);
        const chapters = parse(wikitext);
        const count = Object.values(chapters).reduce((sum, ch) => sum + Object.keys(ch).length, 0);
        verses += count;

        if (!count) {
            console.warn(`!! ${plan.page}: ни одного стиха — разметка страницы иная?`);
        }

        const section = canonSection.get(plan.canonId);
        books.push({
            slug: plan.slug,
            canonId: plan.canonId,
            name: plan.name,
            greekName: "",
            testament: section && NT_SECTIONS.has(section) ? "nt" : "ot",
            outsideCanon: !canonOrder.has(plan.canonId),
            order: canonOrder.get(plan.canonId) ?? 900 + books.length,
            edition: "ro-1914",
            sourceUrl: `${BASE}/${encodeURIComponent(plan.page.replace(/ /g, "_"))}`,
            chapters,
        });

        console.log(`${plan.page.padEnd(46)} глав ${String(Object.keys(chapters).length).padStart(3)}, стихов ${count}`);
        // Викитека — чужой сервер, и торопиться нам некуда.
        await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const source = {
        code: "ro-1914",
        title: "Biblia 1914 (румынская синодальная, латиница)",
        shortTitle: "РУМ 1914",
        langCode: "ro",
        language: "ro",
        versification: "ro-1914",
        year: 1914,
        sourceLink: "https://ro.wikisource.org/wiki/Biblia_1914",
        scope: "full",
        canon: "sla",
        order: 6,
        // Чтения дня по-румынски собираются с кириллического издания 1688 года —
        // оно наше собственное и остаётся главным. Это подложка, а не замена.
        isDefaultForLang: false,
        books,
    };

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(source, null, 1), "utf-8");
    console.log(`\n${OUT}: книг ${books.length}, стихов ${verses}`);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
