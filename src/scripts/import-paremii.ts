// Импорт паремий (чтений из Ветхого Завета на вечерне, после прокимна — поле
// vespersProkimenon) с azbyka.ru/paremijnik. Третий источник зачал наряду с
// gospel/apostle — pericopes.source="paremia".
//
// Покрывает: двунадесятые праздники, великие недвунадесятые праздники, общие
// святым по чину. НЕ покрывает: паремии будних дней Великого поста (Бытие/Притчи
// по седмицам) — отдельный источник, будет решаться позже.
//
// Навечерие/Вечерня X и часовые паремии (на 1/3/6/9 часе) сознательно пропущены —
// это Царские часы, другая служба, под которую пока нет отдельного поля.
//
// Запуск: npx tsx src/scripts/import-paremii.ts
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { findBookByCode } from "@/utils/texts";

const URL = "https://azbyka.ru/paremijnik";
const USER_AGENT = "Mozilla/5.0 (compatible; typikon.su-importer/1.0; +https://typikon.su)";

// azbyka.ru использует западную нумерацию для двух последних книг Царств
// (3-я Царств = "1King", 4-я Царств = "2King"), не совпадающую с bookMap.
const CODE_ALIASES: Record<string, { slug: string; abbreviation: string }> = {
    "1King": { slug: "3-tsarstv", abbreviation: "3Цар" },
    "2King": { slug: "4-tsarstv", abbreviation: "4Цар" },
};

interface IRange { chapterFrom: number; verseFrom: number; chapterTo: number; verseTo: number; }

// Скопировано из import-zachala.ts — тот же формат диапазонов у azbyka.ru.
const parseChapterParam = (param: string): IRange[] => {
    const ranges: IRange[] = [];
    let currentChapter: number | null = null;
    param.split(",").map(s => s.trim()).forEach(seg => {
        let m: RegExpMatchArray | null;
        if ((m = seg.match(/^(\d+):(\d+)-(\d+):(\d+)$/))) {
            ranges.push({ chapterFrom: +m[1], verseFrom: +m[2], chapterTo: +m[3], verseTo: +m[4] });
            currentChapter = +m[3];
        } else if ((m = seg.match(/^(\d+):(\d+)-(\d+)$/))) {
            ranges.push({ chapterFrom: +m[1], verseFrom: +m[2], chapterTo: +m[1], verseTo: +m[3] });
            currentChapter = +m[1];
        } else if ((m = seg.match(/^(\d+):(\d+)$/))) {
            ranges.push({ chapterFrom: +m[1], verseFrom: +m[2], chapterTo: +m[1], verseTo: +m[2] });
            currentChapter = +m[1];
        } else if (currentChapter !== null && (m = seg.match(/^(\d+)-(\d+):(\d+)$/))) {
            ranges.push({ chapterFrom: currentChapter, verseFrom: +m[1], chapterTo: +m[2], verseTo: +m[3] });
            currentChapter = +m[2];
        } else if (currentChapter !== null && (m = seg.match(/^(\d+)-(\d+)$/))) {
            ranges.push({ chapterFrom: currentChapter, verseFrom: +m[1], chapterTo: currentChapter, verseTo: +m[2] });
        } else if (currentChapter !== null && (m = seg.match(/^(\d+)$/))) {
            ranges.push({ chapterFrom: currentChapter, verseFrom: +m[1], chapterTo: currentChapter, verseTo: +m[1] });
        } else {
            console.warn(`  !! не распарсен сегмент "${seg}" (param="${param}")`);
        }
    });
    return ranges;
};

interface IRef { bookSlug: string; abbreviation: string; ranges: IRange[]; display: string; }
interface IHeadingBlock { heading: string; refs: IRef[]; }

const parseSection = (sectionHtml: string): IHeadingBlock[] => {
    const blocks: IHeadingBlock[] = [];
    // Разбиваем по заголовкам <strong>...</strong>, каждый блок — заголовок + весь HTML до следующего.
    const parts = sectionHtml.split(/<p[^>]*><strong>([^<]+)<\/strong><\/p>/);
    // parts[0] — преамбула до первого заголовка (мусор), затем чередование heading/html.
    for (let i = 1; i < parts.length; i += 2) {
        const heading = parts[i].trim();
        const body = parts[i + 1] || "";
        const refs: IRef[] = [];
        for (const m of body.matchAll(/data-title='\?title=([A-Za-z0-9]+)&chapter=([^&']+)[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/g)) {
            const [, code, chapterRaw] = m;
            const display = m[3];
            const bookInfo = CODE_ALIASES[code] || findBookByCode(code);
            if (!bookInfo) { console.warn(`  !! неизвестный код книги "${code}" в "${heading}"`); continue; }
            const ranges = parseChapterParam(decodeURIComponent(chapterRaw));
            if (ranges.length === 0) continue;
            refs.push({ bookSlug: bookInfo.slug, abbreviation: bookInfo.abbreviation, ranges, display });
        }
        if (refs.length > 0) blocks.push({ heading, refs });
    }
    return blocks;
};

type Target =
    | { kind: "fixed"; month: number; day: number }
    | { kind: "movable"; type: string; value: number; weekIndex: number }
    | { kind: "commons"; alias: string; name: string }
    | { kind: "skip" };

const TARGETS: Record<string, Target> = {
    "Паремии Богородичных праздников": { kind: "commons", alias: "commons-bogorodichnye-prazdniki", name: "Богородичные праздники" },
    "Навечерие Рождества Христова": { kind: "skip" },
    "Вечерня Рождества Христова": { kind: "skip" },
    "Рождество Христово": { kind: "fixed", month: 12, day: 25 },
    "Навечерие Богоявления": { kind: "skip" },
    "Вечерня Богоявления": { kind: "skip" },
    "Богоявление": { kind: "fixed", month: 1, day: 6 },
    "На Великое освящение воды": { kind: "skip" },
    "Сретение Господне": { kind: "fixed", month: 2, day: 2 },
    "Благовещение Пресвятой Богородицы": { kind: "fixed", month: 3, day: 25 },
    "Вход Господень в Иерусалим": { kind: "movable", type: "Fast", value: 6, weekIndex: 7 },
    "Преполовение Пятидесятницы": { kind: "movable", type: "Pascha", value: 4, weekIndex: 3 },
    "Вознесение Господне": { kind: "movable", type: "Pascha", value: 6, weekIndex: 4 },
    "Пятидесятница": { kind: "movable", type: "Pascha", value: 8, weekIndex: 0 },
    "Преображение Господне": { kind: "fixed", month: 8, day: 6 },
    "Воздвижение Креста Господня": { kind: "fixed", month: 9, day: 14 },
    "Введение во Храм Пресвятой Богородицы": { kind: "fixed", month: 11, day: 21 },
    "Обрезание Господне": { kind: "fixed", month: 1, day: 1 },
    "Рождество Иоанна Предтечи": { kind: "fixed", month: 6, day: 24 },

    "Святым бесплотным силам": { kind: "commons", alias: "commons-besplotnym-silam", name: "Святым бесплотным силам" },
    "Святителю": { kind: "commons", alias: "commons-svyatitelyu", name: "Святителю" },
    "Святителям": { kind: "commons", alias: "commons-svyatitelyam", name: "Общее святителям" },
    "Преподобным": { kind: "commons", alias: "commons-prepodobnym", name: "Общее преподобным" },
    "Мученикам": { kind: "commons", alias: "commons-muchenikam", name: "Общее мученикам" },
    "Мученикам, священномученику, священномученикам, бессеребренникам, мученице, мученицам, преподобным женам, преподобномученице, преподбномученицам":
        { kind: "commons", alias: "commons-muchenikam-obshchee-2", name: "Мученикам, священномученику и др. (общее)" },
    "Преподобному, преподобным, преподобномученику, преподобномученикам, исповеднику, Христа ради юродивому, преподобной жене":
        { kind: "commons", alias: "commons-prepodobnym-obshchee-2", name: "Преподобному, исповеднику, юродивому и др. (общее)" },
    "Святому и Животворящему Кресту": { kind: "commons", alias: "commons-krestu", name: "Святому и Животворящему Кресту" },
    "Cвятому Иоанну Предтече": { kind: "commons", alias: "commons-ioannu-predtechi", name: "Святому Иоанну Предтече" },
    "Пророку": { kind: "commons", alias: "commons-proroku", name: "Пророку" },
    "Апостолу": { kind: "commons", alias: "commons-apostolu", name: "Апостолу" },
    "Апостолам": { kind: "commons", alias: "commons-apostolam", name: "Общее апостолам" },
    "Святым отцам": { kind: "commons", alias: "commons-svyatym-ottsam", name: "Святым отцам" },
};

const emptyCommonsDay = (name: string, alias: string) => ({
    name, commons: true, commonsRank: name, alias,
    vespersProkimenon: null, vigil: null, kathisma1: null, kathisma2: null, kathisma3: null,
    ipakoi: null, polyeleos: null, song3: null, song6: null, apolutikaTroparia: null,
    before1h: null, h1: null, h3: null, h6: null, h9: null, panagia: null, fileId: null,
    subnames: [] as string[], paschal: false, weekId: null, monthId: null, weekIndex: null,
    monthIndex: null, createdAt: new Date(), before50: null, apostleLiturgy: null,
    gospelLiturgy: null, gospelMatins: null, updatedAt: new Date(),
});

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const pericopesCol = db.collection("pericopes");
    const daysCol = db.collection("days");
    const weeksCol = db.collection("weeks");
    const monthsCol = db.collection("months");

    const res = await fetch(URL, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status} для ${URL}`);
    const html = await res.text();

    const h2Sections = html.split(/<h2>/).slice(1); // [0] — Двунадесятые, [1] — Страстная, [2] — Великие недвунадесятые, [3] — Общие святым
    const sectionsToParse = [h2Sections[0], h2Sections[2], h2Sections[3]]; // Страстную седмицу пока не трогаем (там же логика часов/утрени)

    const blocks: IHeadingBlock[] = sectionsToParse.flatMap(parseSection);
    console.log(`Найдено заголовков с чтениями: ${blocks.length}`);

    await pericopesCol.deleteMany({ source: "paremia" });

    const monthIdByValue = new Map((await monthsCol.find({}).toArray()).map(m => [m.value, m._id]));

    let matchedHeadings = 0, skippedHeadings = 0, unknownHeadings = 0, totalPericopes = 0, daysWritten = 0;

    for (const block of blocks) {
        const target = TARGETS[block.heading];
        if (!target) { console.log(`  ПРОПУСК (нет в TARGETS): "${block.heading}"`); unknownHeadings++; continue; }
        if (target.kind === "skip") { skippedHeadings++; continue; }

        const pericopeDocs = block.refs.map(r => ({
            source: "paremia" as const,
            bookSlug: r.bookSlug,
            label: r.display,
            occasions: [block.heading],
            ranges: r.ranges,
            updatedAt: new Date(),
        }));
        const inserted = await pericopesCol.insertMany(pericopeDocs);
        const items = Object.values(inserted.insertedIds).map((id, i) => ({
            cite: "", textId: null, pericopeId: id, paschal: false, description: pericopeDocs[i].label,
        }));
        totalPericopes += pericopeDocs.length;

        let dayId: ObjectId | null = null;
        if (target.kind === "fixed") {
            const monthId = monthIdByValue.get(target.month);
            const day = monthId ? await daysCol.findOne({ monthId, monthIndex: target.day }) : null;
            dayId = day?._id || null;
            if (!dayId) console.log(`  !! не найден календарный день ${target.day}.${target.month} для "${block.heading}"`);
        } else if (target.kind === "movable") {
            const week = await weeksCol.findOne({ type: target.type, value: target.value });
            const day = week ? await daysCol.findOne({ weekId: week._id, weekIndex: target.weekIndex }) : null;
            dayId = day?._id || null;
            if (!dayId) console.log(`  !! не найден подвижный день ${target.type}:${target.value}:${target.weekIndex} для "${block.heading}"`);
        } else if (target.kind === "commons") {
            let day = await daysCol.findOne({ alias: target.alias });
            if (!day) {
                const insertedDay = await daysCol.insertOne(emptyCommonsDay(target.name, target.alias));
                day = { _id: insertedDay.insertedId } as any;
                console.log(`  создан новый commons-день: ${target.alias} (${target.name})`);
            }
            dayId = day!._id;
        }

        if (dayId) {
            await daysCol.updateOne({ _id: dayId }, { $set: { vespersProkimenon: { items } } });
            daysWritten++;
            matchedHeadings++;
            console.log(`  "${block.heading}" -> ${block.refs.length} паремий записано`);
        }
    }

    console.log(`\nИтого: заголовков обработано ${matchedHeadings}, пропущено (Навечерие/часы) ${skippedHeadings}, неизвестных ${unknownHeadings}`);
    console.log(`Всего создано pericopes(paremia): ${totalPericopes}, дней записано: ${daysWritten}`);
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
