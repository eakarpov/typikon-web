// Заполняет gospelMatins тремя видами утренних Евангелий:
// 1. Воскресный 11-круг — сквозной счётчик от Недели всех святых до Недели 5-й
//    Великого поста (полный круг), плюс сокращённый круг Пасха-Троица.
// 2. Праздничные (двунадесятые/великие) — фиксированные и подвижные дни.
// 3. Общие "по чину" на утрене — святителям/апостолам + Богородичные праздники
//    (дописывается в commons-дни, созданные в generate-commons-days.ts).
//
// ВАЖНО: 11-круг здесь привязан к ШАБЛОННОЙ неделе (type+value), НЕ к календарной
// позиции года — так был описан алгоритм пользователем. Если окажется, что реально
// он должен сдвигаться синхронно с отступкой/преступкой Евангелия на Литургии (как
// это бывает по классической практике), это будет отдельной калькуляторной доработкой,
// не меняющей сами шаблонные данные.
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const daysCol = db.collection("days");
    const weeksCol = db.collection("weeks");
    const pericopesCol = db.collection("pericopes");

    const byLabel = new Map<string, any>();
    for (const p of await pericopesCol.find({ source: "gospel" }).toArray()) {
        byLabel.set(p.label, p);
    }
    const need = (label: string) => {
        const p = byLabel.get(label);
        if (!p) throw new Error(`Не найдено зачало ${label}`);
        return p;
    };
    const toItems = (pericopes: any[]) => ({
        items: pericopes.map(p => ({ cite: "", textId: null, pericopeId: p._id, paschal: false, description: p.label })),
    });

    const writeGospelMatins = async (dayId: ObjectId, pericopes: any[]) => {
        await daysCol.updateOne({ _id: dayId }, { $set: { gospelMatins: toItems(pericopes) } });
    };

    const findDayByTypeValueIndex = async (type: string, value: number, weekIndex: number) => {
        const week = await weeksCol.findOne({ type, value });
        if (!week) throw new Error(`Не найдена неделя ${type}:${value}`);
        const day = await daysCol.findOne({ weekId: week._id, weekIndex });
        if (!day) throw new Error(`Не найден день ${type}:${value}:${weekIndex}`);
        return day;
    };

    const findDayByAlias = async (alias: string, weekIndex: number) => {
        const week = await weeksCol.findOne({ alias });
        if (!week) throw new Error(`Не найдена неделя ${alias}`);
        const day = await daysCol.findOne({ weekId: week._id, weekIndex });
        if (!day) throw new Error(`Не найден день ${alias}:${weekIndex}`);
        return day;
    };

    // === 1. Воскресный 11-круг ===
    const CYCLE = ["Мф. 116", "Мк. 70", "Мк. 71", "Лк. 112", "Лк. 113", "Лк. 114", "Ин. 63", "Ин. 64", "Ин. 65В", "Ин. 66", "Ин. 67"];
    const readingAt = (position: number) => CYCLE[(position - 1) % 11];

    // Полный круг: позиции 1-33 (по Пятидесятнице) + 34-37 (предуготовительные) + 38-42 (посты 1-5).
    const fullCircleTargets: { type: string; value?: number; alias?: string; weekIndex: number }[] = [
        { type: "Penticostarion", value: 1, weekIndex: 7 },
        ...Array.from({ length: 32 }, (_, i) => ({ type: "first", value: i + 2, weekIndex: 7 })),
        { type: "Triodion", alias: "mytaria", weekIndex: 0 },
        { type: "Triodion", alias: "bludnogo-syna", weekIndex: 0 },
        { type: "Triodion", alias: "strasny-sud", weekIndex: 7 },
        { type: "Triodion", alias: "syrnaja", weekIndex: 7 },
        ...Array.from({ length: 5 }, (_, i) => ({ type: "Fast", value: i + 1, weekIndex: 7 })),
    ];

    let fullCircleCount = 0;
    for (let i = 0; i < fullCircleTargets.length; i++) {
        const t = fullCircleTargets[i];
        const day = t.alias ? await findDayByAlias(t.alias, t.weekIndex) : await findDayByTypeValueIndex(t.type, t.value!, t.weekIndex);
        const label = readingAt(i + 1);
        await writeGospelMatins(day._id, [need(label)]);
        fullCircleCount++;
    }
    console.log(`Полный 11-круг: записано ${fullCircleCount} недель (${fullCircleTargets[0].type}:1 .. Fast:5)`);

    // Сокращённый круг Пасха-Троица: value=1 (Пасха) без чтения; 2..7 -> 1,3,4,7,8,10; 8 (Троица) — праздничное.
    const PASCHA_SHORT: Record<number, number> = { 2: 1, 3: 3, 4: 4, 5: 7, 6: 8, 7: 10 };
    for (const [value, position] of Object.entries(PASCHA_SHORT)) {
        const day = await findDayByTypeValueIndex("Pascha", Number(value), 0);
        await writeGospelMatins(day._id, [need(readingAt(position))]);
    }
    const troitsa = await findDayByTypeValueIndex("Pascha", 8, 0);
    await writeGospelMatins(troitsa._id, [need("Ин. 65А")]); // "Пятидесятница на утрене" — праздничное, вытесняет воскресное
    console.log("Сокращённый круг Пасха-Троица: записано 6 + Троица праздничным (Ин. 65А)");

    // === 2. Праздничные (двунадесятые/великие) ===
    // Фиксированные: [месяц, число][], список зачал (могут быть альтернативные варианты на одну дату).
    const FIXED_FEASTS: { md: [number, number][]; labels: string[] }[] = [
        { md: [[11, 8]], labels: ["Мф. 52Б"] }, // Архистратиг Михаил
        { md: [[8, 29]], labels: ["Мф. 57"] }, // 29 августа
        { md: [[7, 10]], labels: ["Мф. 112", "Мк. 67А"] }, // положение Ризы Господней — два варианта
        { md: [[1, 6]], labels: ["Мк. 2А"] }, // Богоявление
        { md: [[8, 6]], labels: ["Мк. 38", "Лк. 45"] }, // Преображение — два варианта
        { md: [[7, 24]], labels: ["Лк. 3Б"] },
        { md: [[2, 2]], labels: ["Лк. 8А"] }, // Сретение
        { md: [[2, 24], [5, 25]], labels: ["Лк. 31"] }, // обретение главы Иоанна Предтечи — два дня, одно зачало
        { md: [[4, 23], [11, 3]], labels: ["Лк. 63"] }, // вмч. Георгий — два дня
        { md: [[9, 14]], labels: ["Ин. 42Б"] }, // Воздвижение
    ];
    const months = await db.collection("months").find({}).toArray();
    const monthIdByValue = new Map(months.map(m => [m.value, m._id]));

    let fixedFeastCount = 0;
    for (const feast of FIXED_FEASTS) {
        const pericopes = feast.labels.map(need);
        for (const [month, day] of feast.md) {
            const monthId = monthIdByValue.get(month);
            if (!monthId) throw new Error(`Не найден месяц ${month}`);
            const dayDoc = await daysCol.findOne({ monthId, monthIndex: day });
            if (!dayDoc) { console.log(`  ПРОПУСК: не найден календарный день ${day}.${month} для ${feast.labels.join(",")}`); continue; }
            await writeGospelMatins(dayDoc._id, pericopes);
            fixedFeastCount++;
        }
    }
    console.log(`Праздничные (фиксированные): записано ${fixedFeastCount}`);

    // Подвижные: конкретный (type,value,weekIndex).
    const MOVABLE_FEASTS: { type: string; value: number; weekIndex: number; labels: string[] }[] = [
        { type: "Fast", value: 6, weekIndex: 7, labels: ["Мф. 83А"] }, // Неделя ваий
        { type: "Fast", value: 7, weekIndex: 1, labels: ["Мф. 84Б"] }, // Великий понедельник
        { type: "Fast", value: 7, weekIndex: 2, labels: ["Мф. 90Б"] }, // Великий вторник
        { type: "Fast", value: 7, weekIndex: 3, labels: ["Ин. 41Б"] }, // Великая среда
        { type: "Fast", value: 7, weekIndex: 4, labels: ["Лк. 108Б"] }, // Великий четверг
        { type: "Pascha", value: 6, weekIndex: 4, labels: ["Мк. 71"] }, // Вознесение
    ];
    let movableFeastCount = 0;
    for (const feast of MOVABLE_FEASTS) {
        const day = await findDayByTypeValueIndex(feast.type, feast.value, feast.weekIndex);
        await writeGospelMatins(day._id, feast.labels.map(need));
        movableFeastCount++;
    }
    console.log(`Праздничные (подвижные): записано ${movableFeastCount}`);

    // === 3. Общие "по чину" на утрене ===
    const commonsSvyatiteli = await daysCol.findOne({ alias: "commons-svyatitelyam" });
    if (commonsSvyatiteli) await writeGospelMatins(commonsSvyatiteli._id, [need("Ин. 35Б")]);
    const commonsApostoli = await daysCol.findOne({ alias: "commons-apostolam" });
    if (commonsApostoli) await writeGospelMatins(commonsApostoli._id, [need("Ин. 67")]);

    // Богородичные праздники "на утрене" — отдельный общий (не по чину святого, а по типу праздника).
    const bogorodichnyAlias = "commons-bogorodichnye-prazdniki";
    const existingBogorodichny = await daysCol.findOne({ alias: bogorodichnyAlias });
    if (existingBogorodichny) {
        await writeGospelMatins(existingBogorodichny._id, [need("Лк. 4")]);
    } else {
        await daysCol.insertOne({
            name: "Богородичные праздники", commons: true, commonsRank: "Богородичные праздники",
            alias: bogorodichnyAlias,
            vespersProkimenon: null, vigil: null, kathisma1: null, kathisma2: null, kathisma3: null,
            ipakoi: null, polyeleos: null, song3: null, song6: null, apolutikaTroparia: null,
            before1h: null, h1: null, h3: null, h6: null, h9: null, panagia: null, fileId: null,
            subnames: [], paschal: false, weekId: null, monthId: null, weekIndex: null, monthIndex: null,
            createdAt: new Date(), before50: null, apostleLiturgy: null, gospelLiturgy: null,
            gospelMatins: toItems([need("Лк. 4")]), updatedAt: new Date(),
        });
    }
    console.log("Общие на утрене: святителям (Ин. 35Б), апостолам (Ин. 67), Богородичные праздники (Лк. 4)");
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
