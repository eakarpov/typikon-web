// Импорт месяцеслова Типикона (Глава 48) с azbyka.ru в коллекцию `signs`.
// Один документ = одна память дня (после разбиения перечислений "И ...:").
//
// Особенность источника: любая из 12 URL azbyka.ru/otechnik/.../tipikon/48_N отдаёт ОДИН
// и тот же полный HTML со всеми 12 месяцами месяцеслова (id вида "48_{page}_{day}" для
// каждого месяца встречаются все в одном документе) — поэтому делаем один fetch, а не 12.
//
// Знаки (см. подробный разбор разметки в плане):
//   🕀 U+1F540 -> GREAT_VIGIL (всегда)
//   🕁 U+1F541 -> VIGIL (всегда, независимо от цвета в разметке)
//   🕂 U+1F542 -> POLYELEOS (всегда)
//   🕃 U+1F543 -> цвет определяет ранг: внутри <span class="color-red"> -> DOXOLOGIC,
//                 вне (чёрный) -> SIX_STICHERA
//   иконки нет -> NO_SIGN, если не сработала эвристика на аллилуйную службу (см. ниже)
//
// Аллилуйная служба не имеет иконки — определяется по первому абзацу службы дня
// (фразы "Аллилуиа.", "Аллилуиа, или тропарь", "Аще есть четыредесятница, поем Аллилуиа").
// Условные формулировки ("Аще...") дают additionally signConditional=true.
//
// Дополнительные памяти могут идти не только в заголовке дня через "И ...:", но и отдельным
// абзацем внутри блока дня (со своей иконкой) — сканируем все абзацы блока, не только заголовок.
//
// Идемпотентно: перед первым запуском по явному подтверждению пользователя очищает
// прежние source="typikon" записи (в dev-окружении там были тестовые записи, не связанные
// с этим импортом), затем пишет заново. Повторный запуск — insertMany после того же clear,
// дублей не будет, т.к. запуск всегда начинается с чистой коллекции source="typikon".
//
// Запуск: npx tsx src/scripts/import-tipikon-menology.ts [--months=9,10]
//         DRY_RUN=1 npx tsx src/scripts/import-tipikon-menology.ts
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { SIGN } from "@/types/dto/days";

const SOURCE_URL = "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/48_1";
const USER_AGENT = "Mozilla/5.0 (compatible; typikon.su-importer/1.0; +https://typikon.su)";
const DRY_RUN = process.env.DRY_RUN === "1";

// Индекс страницы (1..12) -> номер месяца, январь = 1 (сентябрь = 9).
const PAGE_MONTH: Record<number, number> = {
    1: 9, 2: 10, 3: 11, 4: 12, 5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 10: 6, 11: 7, 12: 8,
};

const monthsFilter = (() => {
    const arg = process.argv.find(a => a.startsWith("--months="));
    if (!arg) return null;
    return new Set(arg.slice("--months=".length).split(",").map(Number));
})();

// Формат "месяц.число", например "1.9,8.9,14.9" — печатает разобранные памяти этих дней целиком,
// для точечной сверки с источником при отладке парсера.
const verboseDays = (() => {
    const arg = process.argv.find(a => a.startsWith("--verbose-days="));
    if (!arg) return new Set<string>();
    return new Set(arg.slice("--verbose-days=".length).split(","));
})();

const decodeEntities = (s: string) => s
    .replace(/&nbsp;/g, " ")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

// Убирает символы иконок-знаков (U+1F540..U+1F543 и подобные) из уже очищенного от тегов текста —
// нужно, т.к. stripTags сохраняет текстовое содержимое span'ов, включая сам символ иконки.
const stripIcons = (text: string) => Array.from(text).filter(ch => (ch.codePointAt(0) || 0) < 0x1f000).join("").replace(/\s+/g, " ").trim();

// Проверяет, находится ли позиция uptoIndex внутри <span class="color-red">, отслеживая
// только span-теги (в разметке дня вложены только span'ы: color-red/ponomar/pere).
const isInsideColorRed = (html: string, uptoIndex: number): boolean => {
    const stack: string[] = [];
    const tagRe = /<\/?span[^>]*>/g;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(html)) && m.index < uptoIndex) {
        if (m[0].startsWith("</")) {
            stack.pop();
        } else {
            const clsMatch = m[0].match(/class="([^"]*)"/);
            stack.push(clsMatch ? clsMatch[1] : "");
        }
    }
    return stack.some(c => c.includes("color-red"));
};

const glyphToSign = (glyph: string, isRed: boolean): SIGN | null => {
    const cp = glyph.codePointAt(0);
    switch (cp) {
        case 0x1f540: return SIGN.GREAT_VIGIL;
        case 0x1f541: return SIGN.VIGIL;
        case 0x1f542: return SIGN.POLYELEOS;
        case 0x1f543: return isRed ? SIGN.DOXOLOGIC : SIGN.SIX_STICHERA;
        default: return null;
    }
};

// Первая найденная иконка <span class="ponomar">X</span> в куске HTML (заголовок или абзац).
const firstPonomarSign = (html: string): SIGN | null => {
    const re = /<span class="ponomar">([^<]+)<\/span>/;
    const m = re.exec(html);
    if (!m) return null;
    return glyphToSign(m[1], isInsideColorRed(html, m.index));
};

const HALLELUJAH_TRIGGERS = [
    /^\s*Аллилуиа\s*\./,
    /^\s*Аллилуиа,\s*или\s*тропарь/,
    /^\s*[АA]ще\s+есть\s+четыредесятниц[а-яё]*,\s*поем\s+Аллилуиа/i,
];

const NEEDS_REVIEW_TRIGGERS = [
    "аще хощет настоятель",
    "аще настоятель изволит",
    "полагаем бдение",
];

// Отличает самостоятельный абзац-память ("И преподобнаго ...: ") от обычного абзаца службы,
// который просто начинается с союза "И" (рубрики почти всегда содержат номер гласа/зачала/etc,
// чистая память святого — нет; также ограничиваем длину и требуем завершающее двоеточие).
const looksLikeStandaloneMemory = (plain: string): boolean => {
    if (!/^И\s+\S/.test(plain)) return false;
    if (!plain.trim().endsWith(":")) return false;
    if (plain.length > 250) return false;
    if (/\d/.test(plain)) return false;
    return true;
};

interface ParsedMemory {
    name: string;
    sign: SIGN;
    signConditional: boolean;
    isDefault: boolean;
}

const splitHeaderMemories = (headerText: string): string[] => {
    // headerText уже без тегов/номера дня/иконки. Делится по ": И " (заглавная И — начало новой памяти).
    const parts = headerText.split(/:\s*И\s+/);
    return parts
        .map((part, i) => (i === 0 ? part : `И ${part}`))
        .map(p => p.trim())
        .filter(Boolean);
};

interface DayResult {
    month: number;
    date: number;
    memories: ParsedMemory[];
    needsReview: boolean;
    sourceUrl: string;
}

const parseDayBlock = (blockHtml: string, page: number, day: number): DayResult => {
    const month = PAGE_MONTH[page];
    const sourceUrl = `https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/48_${page}#48_${page}_${day}`;

    // Первый <p ...>...</p> — заголовок дня.
    const firstCloseIdx = blockHtml.indexOf("</p>");
    const headerHtml = blockHtml.slice(0, firstCloseIdx + 4);
    const restHtml = blockHtml.slice(firstCloseIdx + 4);

    const headerSign = firstPonomarSign(headerHtml);
    // Текст заголовка без "N." и без самого символа иконки.
    const headerText = stripIcons(stripTags(headerHtml.replace(/<b>\d+\.<\/b>/, "")));
    const headerMemoryTexts = splitHeaderMemories(headerText);

    const memories: ParsedMemory[] = headerMemoryTexts.map((name, i) => ({
        name,
        sign: i === 0 ? (headerSign ?? SIGN.NO_SIGN) : SIGN.NO_SIGN,
        signConditional: false,
        isDefault: i === 0,
    }));

    // Остальные абзацы блока дня — доп. памяти вида "И ...:" (со своей иконкой либо без) +
    // проверка на аллилуйную службу в первом абзаце + needsReview-триггеры по всему остатку.
    const paragraphRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let pm: RegExpExecArray | null;
    let firstRubricChecked = false;
    let restPlainForReview = "";
    while ((pm = paragraphRe.exec(restHtml))) {
        const paragraphHtml = pm[0];
        const plain = stripIcons(stripTags(paragraphHtml));
        restPlainForReview += ` ${plain}`;

        if (!firstRubricChecked) {
            firstRubricChecked = true;
            for (const trigger of HALLELUJAH_TRIGGERS) {
                if (trigger.test(plain)) {
                    memories[0].sign = SIGN.HALLELUJAH;
                    // Аллилуйная служба в месяцеслове всегда зависит от того, попадёт ли эта
                    // фиксированная дата на будний день Великого поста в конкретный год —
                    // даже когда формулировка источника не содержит явного "Аще" (например,
                    // отсылает "как вчера"), сама зависимость от Пасхалии никуда не девается.
                    memories[0].signConditional = true;
                    break;
                }
            }
        }

        if (looksLikeStandaloneMemory(plain)) {
            const sign = firstPonomarSign(paragraphHtml);
            memories.push({
                name: plain,
                sign: sign ?? SIGN.NO_SIGN,
                signConditional: false,
                isDefault: false,
            });
        }
    }

    const lowerReview = restPlainForReview.toLowerCase();
    const needsReview = NEEDS_REVIEW_TRIGGERS.some(t => lowerReview.includes(t));

    return { month, date: day, memories, needsReview, sourceUrl };
};

const findLastDayBoundary = (html: string, start: number): number => {
    const headingRe = /<h[1-6][^>]*>/g;
    headingRe.lastIndex = start;
    const m = headingRe.exec(html);
    const cap = start + 50000;
    if (m && m.index < cap) return m.index;
    return cap;
};

const main = async () => {
    console.log(`Загружаю ${SOURCE_URL} ...`);
    const res = await fetch(SOURCE_URL, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status} для ${SOURCE_URL}`);
    const html = await res.text();
    console.log(`Загружено ${(html.length / 1024 / 1024).toFixed(1)} МБ`);

    const dayHeaderRe = /<p id="48_(\d+)_(\d+)">/g;
    const markers: { page: number; day: number; pos: number }[] = [];
    let hm: RegExpExecArray | null;
    while ((hm = dayHeaderRe.exec(html))) {
        markers.push({ page: parseInt(hm[1], 10), day: parseInt(hm[2], 10), pos: hm.index });
    }
    markers.sort((a, b) => a.pos - b.pos);

    // У источника изредка встречаются дни с "битым" id вида <p id="p18"> вместо
    // <p id="48_8_18"> (обнаружено на 18 апреля) — вместо того, чтобы такой день молча
    // потерялся (провалился бы в блок предыдущего дня), находим такие "p{N}" маркеры отдельно
    // и определяем их месяц/страницу по ближайшему предшествующему обычному маркеру.
    const altRe = /<p id="p(\d+)">/g;
    let am: RegExpExecArray | null;
    let altCount = 0;
    while ((am = altRe.exec(html))) {
        const day = parseInt(am[1], 10);
        const pos = am.index;
        let page: number | null = null;
        for (let i = markers.length - 1; i >= 0; i--) {
            if (markers[i].pos < pos) { page = markers[i].page; break; }
        }
        if (page === null) continue;
        markers.push({ page, day, pos });
        altCount++;
    }
    markers.sort((a, b) => a.pos - b.pos);
    if (altCount > 0) console.log(`Найдено дней с нестандартным id (id="pN"): ${altCount}`);
    console.log(`Найдено дневных заголовков: ${markers.length}`);

    // Проверка на пропуски в нумерации дней внутри каждой страницы/месяца — сигнал, что источник
    // мог использовать ещё какой-то нестандартный формат id, который мы не ловим.
    const byPage = new Map<number, number[]>();
    for (const m of markers) {
        if (!byPage.has(m.page)) byPage.set(m.page, []);
        byPage.get(m.page)!.push(m.day);
    }
    for (const [page, days] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
        const sorted = [...days].sort((a, b) => a - b);
        for (let d = 1; d < sorted.length; d++) {
            if (sorted[d] !== sorted[d - 1] + 1) {
                console.warn(`  !! пропуск в нумерации дней: месяц ${PAGE_MONTH[page]} (страница 48_${page}), между ${sorted[d - 1]} и ${sorted[d]}`);
            }
        }
    }

    const results: DayResult[] = [];
    for (let i = 0; i < markers.length; i++) {
        const { page, day, pos } = markers[i];
        if (monthsFilter && !monthsFilter.has(PAGE_MONTH[page])) continue;
        const end = i + 1 < markers.length ? markers[i + 1].pos : findLastDayBoundary(html, pos);
        const block = html.slice(pos, end);
        const result = parseDayBlock(block, page, day);
        results.push(result);
        if (verboseDays.has(`${result.date}.${result.month}`)) {
            console.log(`\n[verbose] ${result.date}.${result.month} (${result.sourceUrl}) needsReview=${result.needsReview}`);
            result.memories.forEach((m, i) => console.log(`  #${i} isDefault=${m.isDefault} sign=${m.sign} conditional=${m.signConditional} :: ${m.name}`));
        }
    }

    const perMonthCount = new Map<number, number>();
    let totalMemories = 0;
    const reviewDays: string[] = [];
    const conditionalDays: string[] = [];
    for (const r of results) {
        perMonthCount.set(r.month, (perMonthCount.get(r.month) || 0) + 1);
        totalMemories += r.memories.length;
        if (r.needsReview) reviewDays.push(`${r.date}.${r.month}`);
        if (r.memories.some(m => m.signConditional)) conditionalDays.push(`${r.date}.${r.month}`);
    }

    console.log("\nДней по месяцам:");
    for (const [month, count] of [...perMonthCount.entries()].sort((a, b) => a[0] - b[0])) {
        console.log(`  месяц ${month}: ${count} дней`);
    }
    console.log(`Всего памятей: ${totalMemories}`);
    console.log(`needsReview: ${reviewDays.length} дней -> ${reviewDays.join(", ")}`);
    console.log(`signConditional: ${conditionalDays.length} дней -> ${conditionalDays.join(", ")}`);

    if (DRY_RUN) {
        console.log("\nDRY_RUN=1 — запись в БД пропущена.");
        return;
    }

    const client = await clientPromise;
    const db = client.db("typikon");
    const collection = db.collection("signs");

    const deleted = await collection.deleteMany({ source: "typikon" });
    console.log(`\nУдалено прежних записей source=typikon: ${deleted.deletedCount}`);

    const docs = results.flatMap(r => r.memories.map((m, order) => ({
        month: r.month,
        date: r.date,
        name: m.name,
        sign: m.sign,
        signConditional: m.signConditional,
        isDefault: m.isDefault,
        order,
        source: "typikon",
        sourceUrl: r.sourceUrl,
        needsReview: r.needsReview,
        createdAt: new Date(),
        updatedAt: new Date(),
    })));

    if (docs.length > 0) {
        await collection.insertMany(docs);
    }
    console.log(`Записано документов: ${docs.length}`);
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
