// Паремии будних дней Великого поста (недели 1-6, Пн-Пт), без Страстной седмицы.
// На 6-м часе — одно чтение из прор. Исаии (поле h6). На вечерне — Бытие + Притчи
// (поле vespersProkimenon, как и праздничные/общие паремии).
// Источник: список, предоставленный пользователем напрямую (не веб-скрейп).
//
// Запуск: npx tsx src/scripts/import-lenten-paremii.ts
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";

interface IRange { chapterFrom: number; verseFrom: number; chapterTo: number; verseTo: number; }

const parseRef = (s: string): IRange => {
    const clean = s.trim();
    if (clean.includes(" – ")) {
        const [a, b] = clean.split(" – ");
        const [cf, vf] = a.split(":").map(Number);
        const [ct, vt] = b.split(":").map(Number);
        return { chapterFrom: cf, verseFrom: vf, chapterTo: ct, verseTo: vt };
    }
    const [c, verses] = clean.split(":");
    const [vf, vt] = verses.split("–").map(Number);
    return { chapterFrom: +c, verseFrom: vf, chapterTo: +c, verseTo: vt };
};

interface IDayReading { week: number; weekIndex: number; weekdayName: string; isaiah: string; genesis: string[]; proverbs: string; }

const WEEKDAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверток", "Пяток"];
const ORDINALS_GEN = ["", "первой", "второй", "третьей", "четвертой", "пятой", "шестой"];

// [isaiah, genesis[], proverbs] по (неделя, будний день 1-5).
const RAW: [string, string[], string][][] = [
    // неделя 1
    [
        ["1:1–20", ["1:1–13"], "1:1–20"],
        ["1:19 – 2:3", ["1:14–23"], "1:20–33"],
        ["2:3–11", ["1:24 – 2:3"], "2:1–22"],
        ["2:11–21", ["2:4–19"], "3:1–18"],
        ["3:1–12", ["2:20 – 3:20"], "3:19–34"],
    ],
    // неделя 2
    [
        ["4:2 – 5:7", ["3:21 – 4:7"], "3:34 – 4:22"],
        ["5:7–16", ["4:8–15"], "5:1–15"],
        ["5:16–25", ["4:16–26"], "5:15 – 6:3"],
        ["6:1–12", ["5:1–24"], "6:3–20"],
        ["7:1–14", ["5:32 – 6:8"], "6:20 – 7:1"],
    ],
    // неделя 3
    [
        ["8:13 – 9:7", ["6:9–22"], "8:1–21"],
        ["9:9 – 10:4", ["7:1–5"], "8:32 – 9:11"],
        ["10:12–20", ["7:6–9"], "9:12–18"],
        ["11:10 – 12:2", ["7:11 – 8:3"], "10:1–22"],
        ["13:2–11", ["8:4–21"], "10:31 – 11:12"],
    ],
    // неделя 4 (Крестопоклонная)
    [
        ["14:24–32", ["8:21 – 9:7"], "11:19 – 12:6"],
        ["25:1–9", ["9:8–17"], "12:8–22"],
        ["26:21 – 27:9", ["9:18 – 10:1"], "12:23 – 13:9"],
        ["28:14–22", ["10:32 – 11:9"], "13:19 – 14:6"],
        ["29:13–24", ["12:1–7"], "14:15–26"],
    ],
    // неделя 5
    [
        ["37:33 – 38:6", ["13:12–18"], "14:27 – 15:4"],
        ["40:18–31", ["15:1–15"], "15:7–19"],
        ["41:4–14", ["17:1–9"], "15:20 – 16:9"],
        ["42:5–16", ["18:20–33"], "16:17 – 17:17"],
        ["45:11–17", ["22:1–18"], "17:17 – 18:5"],
    ],
    // неделя 6 (ваий)
    [
        ["48:17 – 49:4", ["27:1–41"], "19:16–25"],
        ["49:6–10", ["31:3–16"], "21:3–21"],
        ["58:1–11", ["43:26–31", "45:1–16"], "21:23 – 22:4"],
        ["65:8–16", ["46:1–7"], "23:15 – 24:5"],
        ["66:10–24", ["49:33 – 50:26"], "31:8–31"],
    ],
];

const DATA: IDayReading[] = RAW.flatMap((week, wi) =>
    week.map(([isaiah, genesis, proverbs], di) => ({
        week: wi + 1, weekIndex: di + 1, weekdayName: WEEKDAY_NAMES[di], isaiah, genesis, proverbs,
    })),
);

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const pericopesCol = db.collection("pericopes");
    const daysCol = db.collection("days");
    const weeksCol = db.collection("weeks");

    await pericopesCol.deleteMany({ source: "paremia", lentenWeekday: true });

    let h6Count = 0, vespersCount = 0;

    for (const d of DATA) {
        const occasionLabel = `${d.weekdayName} ${ORDINALS_GEN[d.week]} седмицы Великого поста`;
        const week = await weeksCol.findOne({ type: "Fast", value: d.week });
        if (!week) throw new Error(`Не найдена неделя Fast:${d.week}`);
        const day = await daysCol.findOne({ weekId: week._id, weekIndex: d.weekIndex });
        if (!day) throw new Error(`Не найден день Fast:${d.week}:${d.weekIndex}`);

        const isaiahDoc = { source: "paremia" as const, lentenWeekday: true, bookSlug: "isaii", label: `Ис. ${d.isaiah}`, occasions: [occasionLabel], ranges: [parseRef(d.isaiah)], updatedAt: new Date() };
        const genesisDoc = { source: "paremia" as const, lentenWeekday: true, bookSlug: "bytie", label: `Быт. ${d.genesis.join("; ")}`, occasions: [occasionLabel], ranges: d.genesis.map(parseRef), updatedAt: new Date() };
        const proverbsDoc = { source: "paremia" as const, lentenWeekday: true, bookSlug: "pritchi", label: `Притч. ${d.proverbs}`, occasions: [occasionLabel], ranges: [parseRef(d.proverbs)], updatedAt: new Date() };

        const isaiahIns = await pericopesCol.insertOne(isaiahDoc);
        const genesisIns = await pericopesCol.insertOne(genesisDoc);
        const proverbsIns = await pericopesCol.insertOne(proverbsDoc);

        // h6 может уже содержать святоотеческое чтение (textId) — добавляем паремию
        // ПЕРЕД существующим, не затирая (порядок: сначала паремия, потом то, что было).
        const existingH6 = day.h6?.items || [];
        await daysCol.updateOne({ _id: day._id }, {
            $set: {
                h6: { items: [{ cite: "", textId: null, pericopeId: isaiahIns.insertedId, paschal: false, description: isaiahDoc.label }, ...existingH6] },
                vespersProkimenon: {
                    items: [
                        { cite: "", textId: null, pericopeId: genesisIns.insertedId, paschal: false, description: genesisDoc.label },
                        { cite: "", textId: null, pericopeId: proverbsIns.insertedId, paschal: false, description: proverbsDoc.label },
                    ],
                },
            },
        });
        h6Count++; vespersCount++;
        console.log(`${occasionLabel}: h6=${isaiahDoc.label}, вечерня=${genesisDoc.label} + ${proverbsDoc.label}`);
    }

    console.log(`\nИтого: дней с h6 — ${h6Count}, дней с vespersProkimenon — ${vespersCount}`);
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
