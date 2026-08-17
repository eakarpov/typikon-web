// Паремии Страстной седмицы (Fast type, value=7, weekIndex 1-6).
// Пн-Пт — данные от пользователя напрямую. Великая суббота (15 паремий Вечерни) —
// с azbyka.ru/paremijnik, раздел "Страстная седмица" (сознательно пропущенный при
// первом заходе, см. import-paremii.ts).
//
// ВАЖНО: h1/h3/h6/h9 на этих днях уже могут содержать святоотеческие чтения
// (textId-ссылки, поле "statia") — НЕ перезаписываем, а ДОБАВЛЯЕМ паремию ПЕРЕД
// уже существующими элементами (порядок: сначала паремии, потом святоотеческое —
// по прямому указанию пользователя).
//
// Запуск: npx tsx src/scripts/add-holy-week-paremii.ts
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { findBookByCode } from "@/utils/texts";

interface IRange { chapterFrom: number; verseFrom: number; chapterTo: number; verseTo: number; }

// Общий парсер: "C:V–V" (одна глава), "C:V – C:V" (переход главы, дефис в пробелах),
// сегменты через ";"/"," с наследованием текущей главы ("C:V, V–V, V").
const parseMultiRef = (s: string): IRange[] => {
    const ranges: IRange[] = [];
    let currentChapter: number | null = null;
    for (let seg of s.split(/[;,]/).map(x => x.trim())) {
        let m: RegExpMatchArray | null;
        if ((m = seg.match(/^(\d+):(\d+)\s*–\s*(\d+):(\d+)$/))) {
            ranges.push({ chapterFrom: +m[1], verseFrom: +m[2], chapterTo: +m[3], verseTo: +m[4] });
            currentChapter = +m[3];
        } else if ((m = seg.match(/^(\d+):(\d+)–(\d+)$/))) {
            ranges.push({ chapterFrom: +m[1], verseFrom: +m[2], chapterTo: +m[1], verseTo: +m[3] });
            currentChapter = +m[1];
        } else if ((m = seg.match(/^(\d+):(\d+)$/))) {
            ranges.push({ chapterFrom: +m[1], verseFrom: +m[2], chapterTo: +m[1], verseTo: +m[2] });
            currentChapter = +m[1];
        } else if (currentChapter !== null && (m = seg.match(/^(\d+)–(\d+)$/))) {
            ranges.push({ chapterFrom: currentChapter, verseFrom: +m[1], chapterTo: currentChapter, verseTo: +m[2] });
        } else if (currentChapter !== null && (m = seg.match(/^(\d+)$/))) {
            ranges.push({ chapterFrom: currentChapter, verseFrom: +m[1], chapterTo: currentChapter, verseTo: +m[1] });
        } else {
            console.warn(`  !! не распознан сегмент "${seg}" в "${s}"`);
        }
    }
    return ranges;
};

const CODE_ALIASES: Record<string, { slug: string; abbreviation: string }> = {
    "1King": { slug: "3-tsarstv", abbreviation: "3Цар" },
    "2King": { slug: "4-tsarstv", abbreviation: "4Цар" },
};

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const pericopesCol = db.collection("pericopes");
    const daysCol = db.collection("days");
    const weeksCol = db.collection("weeks");

    await pericopesCol.deleteMany({ source: "paremia", holyWeek: true });

    const week = await weeksCol.findOne({ type: "Fast", value: 7 });
    if (!week) throw new Error("Не найдена неделя Fast:7");
    const dayByIndex = async (weekIndex: number) => {
        const d = await daysCol.findOne({ weekId: week._id, weekIndex });
        if (!d) throw new Error(`Не найден день Fast:7:${weekIndex}`);
        return d;
    };

    const makePericope = async (bookSlug: string, abbreviation: string, refText: string, ranges: IRange[]) => {
        const doc = { source: "paremia" as const, holyWeek: true, bookSlug, label: `${abbreviation}. ${refText}`, occasions: ["Страстная седмица"], ranges, updatedAt: new Date() };
        const ins = await pericopesCol.insertOne(doc);
        return { cite: "", textId: null, pericopeId: ins.insertedId, paschal: false, description: doc.label };
    };

    // Славянское сокращение книги -> {slug, abbreviation} (те же, что в bookMap, плюс Kings-алиасы).
    const BOOK = (ruAbbrev: string, slug: string) => ({ slug, abbreviation: ruAbbrev });
    const B = {
        Ezek: BOOK("Иез", "iezekiilya"), Ex: BOOK("Исх", "iskhod"), Job: BOOK("Иов", "iova"),
        Jer: BOOK("Иер", "ieremii"), Zah: BOOK("Зах", "zakharii"), Is: BOOK("Ис", "isaii"),
        Gen: BOOK("Быт", "bytie"), Jona: BOOK("Ион", "iony"), Nav: BOOK("Нав", "iisus-navin"),
        Sofon: BOOK("Соф", "sofonii"), King1: CODE_ALIASES["1King"], King2: CODE_ALIASES["2King"],
        Dan: BOOK("Дан", "daniila"),
    };

    const setH = async (dayId: ObjectId, field: "h1" | "h3" | "h6" | "h9", item: any, prepend: boolean) => {
        const day = await daysCol.findOne({ _id: dayId });
        const existing = prepend && day?.[field]?.items ? day[field].items : [];
        await daysCol.updateOne({ _id: dayId }, { $set: { [field]: { items: [item, ...existing] } } });
    };

    // === Великий понедельник (weekIndex=1): h6 (уже есть 1 элемент — добавляем перед ним) ===
    {
        const day = await dayByIndex(1);
        const item = await makePericope(B.Ezek.slug, B.Ezek.abbreviation, "1:1–20", parseMultiRef("1:1–20"));
        await setH(day._id, "h6", item, true);
        const exItem = await makePericope(B.Ex.slug, B.Ex.abbreviation, "1:1–20", parseMultiRef("1:1–20"));
        const jobItem = await makePericope(B.Job.slug, B.Job.abbreviation, "1:1–12", parseMultiRef("1:1–12"));
        await daysCol.updateOne({ _id: day._id }, { $set: { vespersProkimenon: { items: [exItem, jobItem] } } });
        console.log("Великий понедельник: h6 (добавлено к существующему), вечерня записана");
    }

    // === Великий вторник (weekIndex=2): h6 пусто — обычная запись ===
    {
        const day = await dayByIndex(2);
        const item = await makePericope(B.Ezek.slug, B.Ezek.abbreviation, "1:21–28", parseMultiRef("1:21–28"));
        await setH(day._id, "h6", item, true); // на случай будущих правок тоже безопасно (existing=[] если пусто)
        const exItem = await makePericope(B.Ex.slug, B.Ex.abbreviation, "2:5–10", parseMultiRef("2:5–10"));
        const jobItem = await makePericope(B.Job.slug, B.Job.abbreviation, "1:13–22", parseMultiRef("1:13–22"));
        await daysCol.updateOne({ _id: day._id }, { $set: { vespersProkimenon: { items: [exItem, jobItem] } } });
        console.log("Великий вторник: h6, вечерня записаны");
    }

    // === Великая среда (weekIndex=3) ===
    {
        const day = await dayByIndex(3);
        const item = await makePericope(B.Ezek.slug, B.Ezek.abbreviation, "2:3 – 3:3", parseMultiRef("2:3 – 3:3"));
        await setH(day._id, "h6", item, true);
        const exItem = await makePericope(B.Ex.slug, B.Ex.abbreviation, "2:11–22", parseMultiRef("2:11–22"));
        const jobItem = await makePericope(B.Job.slug, B.Job.abbreviation, "2:1–10", parseMultiRef("2:1–10"));
        await daysCol.updateOne({ _id: day._id }, { $set: { vespersProkimenon: { items: [exItem, jobItem] } } });
        console.log("Великая среда: h6, вечерня записаны");
    }

    // === Великий четверток (weekIndex=4) — "Вечерня (Литургия)" ===
    {
        const day = await dayByIndex(4);
        const item = await makePericope(B.Jer.slug, B.Jer.abbreviation, "11:18–23; 12:1–5, 9–11, 14–15", parseMultiRef("11:18–23; 12:1–5, 9–11, 14–15"));
        await setH(day._id, "h6", item, true);
        const exItem = await makePericope(B.Ex.slug, B.Ex.abbreviation, "19:10–19", parseMultiRef("19:10–19"));
        const jobItem = await makePericope(B.Job.slug, B.Job.abbreviation, "38:1–23; 42:1–5", parseMultiRef("38:1–23; 42:1–5"));
        const isItem = await makePericope(B.Is.slug, B.Is.abbreviation, "50:4–11", parseMultiRef("50:4–11"));
        await daysCol.updateOne({ _id: day._id }, { $set: { vespersProkimenon: { items: [exItem, jobItem, isItem] } } });
        console.log("Великий четверток: h6, вечерня (литургия) записаны");
    }

    // === Великая пятница (weekIndex=5) — часы + вечерня ===
    {
        const day = await dayByIndex(5);
        const h1Item = await makePericope(B.Zah.slug, B.Zah.abbreviation, "11:10–13", parseMultiRef("11:10–13"));
        await setH(day._id, "h1", h1Item, true);
        const h3Item = await makePericope(B.Is.slug, B.Is.abbreviation, "50:4–11", parseMultiRef("50:4–11"));
        await setH(day._id, "h3", h3Item, true);
        const h6Item = await makePericope(B.Is.slug, B.Is.abbreviation, "52:13 – 54:1", parseMultiRef("52:13 – 54:1"));
        await setH(day._id, "h6", h6Item, true);
        const h9Item = await makePericope(B.Jer.slug, B.Jer.abbreviation, "11:18–23", parseMultiRef("11:18–23"));
        await setH(day._id, "h9", h9Item, true);

        const exItem = await makePericope(B.Ex.slug, B.Ex.abbreviation, "33:11–23", parseMultiRef("33:11–23"));
        const jobItem = await makePericope(B.Job.slug, B.Job.abbreviation, "42:12–17", parseMultiRef("42:12–17"));
        const isItem = await makePericope(B.Is.slug, B.Is.abbreviation, "52:13 – 54:1", parseMultiRef("52:13 – 54:1"));
        await daysCol.updateOne({ _id: day._id }, { $set: { vespersProkimenon: { items: [exItem, jobItem, isItem] } } });
        console.log("Великая пятница: h1/h3/h6/h9, вечерня записаны");
    }

    // === Великая суббота (weekIndex=6) — 15 паремий вечерни, с azbyka.ru ===
    {
        const day = await dayByIndex(6);
        const refs: [typeof B[keyof typeof B], string][] = [
            [B.Gen, "1:1–13"],
            [B.Is, "60:1–16"],
            [B.Ex, "12:1–11"],
            [B.Jona, "1:1–16, 2:1–11, 3:1–10, 4:1–11"],
            [B.Nav, "5:10–15"],
            [B.Ex, "13:20–22, 14:1–32, 15:1–19"],
            [B.Sofon, "3:8–15"],
            [B.King1, "17:1, 8–23"],
            [B.Is, "61:10–11, 62:1–5"],
            [B.Gen, "22:1–18"],
            [B.Is, "61:1–9"],
            [B.King2, "4:8–37"],
            [B.Is, "63:11 – 64:5"],
            [B.Jer, "31:31–34"],
            [B.Dan, "3:1–88"],
        ];
        const items = [];
        for (const [book, ref] of refs) {
            items.push(await makePericope(book.slug, book.abbreviation, ref, parseMultiRef(ref)));
        }
        await daysCol.updateOne({ _id: day._id }, { $set: { vespersProkimenon: { items } } });
        console.log(`Великая суббота: вечерня — записано ${items.length} паремий`);
    }

    console.log("\nГотово.");
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
