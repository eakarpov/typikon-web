// Пишет подтверждённые совпадения (см. match-day-pericopes.ts) в реальные дни:
// добавляет IPartItem с pericopeId в days.gospelLiturgy / days.apostleLiturgy.
// Идемпотентно — повторный запуск не создаёт дублей (проверка по pericopeId
// внутри items массива конкретного поля конкретного дня).
//
// Запуск: npx tsx src/scripts/write-day-pericopes.ts
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { buildIndexes, classifySegment, splitOccasion, IMatch } from "@/scripts/lib/pericope-matcher";

const FIELD_BY_SOURCE = { gospel: "gospelLiturgy", apostle: "apostleLiturgy" } as const;

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const daysCol = db.collection("days");
    const idx = await buildIndexes(db);

    const stats = { itemsAdded: 0, alreadyPresent: 0, daysTouched: new Set<string>(), ambiguous: 0, unresolved: 0 };
    const ambiguousLog: string[] = [];

    for (const source of ["gospel", "apostle"] as const) {
        const field = FIELD_BY_SOURCE[source];
        const pericopes = await db.collection("pericopes").find({ source }).toArray();

        for (const p of pericopes) {
            const pericopeIdStr = p._id.toString();
            const targetDayIds = new Set<string>();

            for (const occasion of (p.occasions || [])) {
                for (const segment of splitOccasion(occasion)) {
                    const result = classifySegment(segment, idx);
                    if (result.kind !== "matched") {
                        if (result.kind === "unresolved") stats.unresolved++;
                        continue;
                    }
                    if (result.matches.length > 1) {
                        stats.ambiguous++;
                        ambiguousLog.push(`"${p.label}" :: "${segment}" -> ${result.matches.map((m: IMatch) => m.dayName).join(" | ")}`);
                    }
                    result.matches.forEach((m: IMatch) => targetDayIds.add(m.dayId));
                }
            }

            for (const dayId of targetDayIds) {
                const day = await daysCol.findOne({ _id: new ObjectId(dayId) });
                if (!day) continue;

                const current = day[field]?.items || [];
                const alreadyThere = current.some((it: any) => it.pericopeId?.toString() === pericopeIdStr);
                if (alreadyThere) { stats.alreadyPresent++; continue; }

                const newItem = {
                    cite: "",
                    textId: null,
                    pericopeId: p._id,
                    paschal: false,
                    description: p.label,
                };
                await daysCol.updateOne(
                    { _id: new ObjectId(dayId) },
                    { $set: { [field]: { items: [...current, newItem] } } },
                );
                stats.itemsAdded++;
                stats.daysTouched.add(dayId);
            }
        }
    }

    console.log("=== ЗАПИСЬ ЗАВЕРШЕНА ===");
    console.log(JSON.stringify({
        itemsAdded: stats.itemsAdded,
        alreadyPresent: stats.alreadyPresent,
        daysTouched: stats.daysTouched.size,
        ambiguous: stats.ambiguous,
        unresolved: stats.unresolved,
    }, null, 2));
    if (ambiguousLog.length > 0) {
        console.log("\n=== НЕОДНОЗНАЧНЫЕ (записано во все варианты, стоит проверить) ===");
        ambiguousLog.forEach(s => console.log(s));
    }
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
