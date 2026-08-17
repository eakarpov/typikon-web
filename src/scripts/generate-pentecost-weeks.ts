// Достраивает недели/дни "по Пятидесятнице" (тип weeks.type === "first").
// Обнаружено: неделя 1 (type=Penticostarion) полностью заполнена (спецназвания).
// Недели 2-15 (type=first) существуют как документы, но почти без дней —
// неделя 2 содержит только Понедельник, недели 3-15 вообще без дней (days: []).
// Недели 16-33 отсутствуют как документы вовсе.
// Цель по указанию пользователя: довести до 33 недель включительно, переиспользуя
// существующий тип "first" (без новых полей), чтобы можно было резолвить зачала
// Евангелия/Апостола по метаданным (type+value = номер недели по Пятидесятнице).
// Идемпотентно: пропускает уже существующие дни (проверка по weekId+weekIndex).
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// Родительный падеж жен. рода ("N-й седмицы по Пятидесятнице") — как в существующем
// шаблоне недели 1: "Вторник первой седмицы по Пятидесятнице". Совпадает с ORDINALS
// в match-day-pericopes.ts (индекс = номер недели).
const ORDINALS_GEN = [
    "", "первой", "второй", "третьей", "четвёртой", "пятой", "шестой", "седьмой",
    "восьмой", "девятой", "десятой", "одиннадцатой", "двенадцатой", "тринадцатой",
    "четырнадцатой", "пятнадцатой", "шестнадцатой", "семнадцатой", "восемнадцатой",
    "девятнадцатой", "двадцатой", "двадцать первой", "двадцать второй", "двадцать третьей",
    "двадцать четвёртой", "двадцать пятой", "двадцать шестой", "двадцать седьмой",
    "двадцать восьмой", "двадцать девятой", "тридцатой", "тридцать первой", "тридцать второй",
    "тридцать третьей",
];

// weekIndex 1-6 = Пн-Сб (архаичные формы Четверток/Пяток — как принято в этой БД).
const WEEKDAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверток", "Пяток", "Суббота"];

const dayName = (weekN: number, weekIndex: number): string => {
    if (weekIndex === 7) {
        // Именительный падеж, цифра+"-я" — подтверждено примером webtypikon.ru
        // ("Неделя 18-я по Пятидесятнице, пред Воздвижением").
        return `Неделя ${weekN}-я по Пятидесятнице`;
    }
    return `${WEEKDAY_NAMES[weekIndex - 1]} ${ORDINALS_GEN[weekN]} седмицы по Пятидесятнице`;
};

const emptyDayDoc = (weekId: ObjectId, weekIndex: number, name: string) => ({
    name,
    vespersProkimenon: null,
    vigil: null,
    kathisma1: null,
    kathisma2: null,
    kathisma3: null,
    ipakoi: null,
    polyeleos: null,
    song3: null,
    song6: null,
    apolutikaTroparia: null,
    before1h: null,
    h1: null,
    h3: null,
    h6: null,
    h9: null,
    panagia: null,
    fileId: null,
    subnames: [] as string[],
    paschal: false,
    weekId,
    monthId: null,
    weekIndex,
    createdAt: new Date(),
    alias: "",
    before50: null,
    monthIndex: null,
    updatedAt: new Date(),
});

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const weeksCol = db.collection("weeks");
    const daysCol = db.collection("days");

    let createdWeeks = 0;
    let createdDays = 0;

    for (let weekN = 2; weekN <= 33; weekN++) {
        let week = await weeksCol.findOne({ type: "first", value: weekN });

        if (!week) {
            const insertResult = await weeksCol.insertOne({
                type: "first",
                value: weekN,
                days: [],
                penticostration: false,
                triodion: false,
                alias: `not-triod-${weekN}`,
                updatedAt: [],
            });
            week = await weeksCol.findOne({ _id: insertResult.insertedId });
            createdWeeks++;
            console.log(`создана неделя ${weekN} (${week!.alias})`);
        }

        const weekId = week!._id as ObjectId;
        const existingDays = await daysCol.find({ weekId }).toArray();
        const existingByIndex = new Set(existingDays.map(d => d.weekIndex));
        const newDayIds: ObjectId[] = [];

        for (let weekIndex = 1; weekIndex <= 7; weekIndex++) {
            if (existingByIndex.has(weekIndex)) continue;
            const doc = emptyDayDoc(weekId, weekIndex, dayName(weekN, weekIndex));
            const inserted = await daysCol.insertOne(doc);
            newDayIds.push(inserted.insertedId);
            createdDays++;
        }

        if (newDayIds.length > 0) {
            const allDays = await daysCol.find({ weekId }).sort({ weekIndex: 1 }).toArray();
            await weeksCol.updateOne(
                { _id: weekId },
                { $set: { days: allDays.map(d => d._id) } },
            );
            console.log(`неделя ${weekN}: добавлено ${newDayIds.length} дней (было ${existingDays.length})`);
        }
    }

    console.log(`\nИтого: создано недель ${createdWeeks}, создано дней ${createdDays}`);
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
