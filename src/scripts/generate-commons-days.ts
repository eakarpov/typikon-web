// Общие службы "по чину" (преподобным, мученикам, святителям и т.п.) — отдельные
// "дни" в коллекции days, НЕ привязанные ни к weeks (movable), ни к months (fixed).
// Помечены commons:true + commonsRank (обычный русский текст чина) для рантайм-мержа:
// когда у конкретного календарного дня нет своего apostleLiturgy/gospelLiturgy,
// подтягиваем сюда подходящий commons-день по чину святого и мержим как календарный
// (см. src/pages/api/calc/index.ts — там уже есть похожий merge для calendarDay).
//
// Сейчас заполняем ТОЛЬКО gospelLiturgy/apostleLiturgy из уже собранных зачал
// (occasions вида "Общее X"). Остальные поля (kathisma/song3/song6/...) и утренние
// общие чтения (Ин.35Б/Ин.67, помечены "на утрене") — осознанно оставлены пустыми,
// заполним позже.
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const emptyDayDoc = (name: string, rank: string, alias: string) => ({
    name,
    commons: true,
    commonsRank: rank,
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
    weekId: null,
    monthId: null,
    weekIndex: null,
    monthIndex: null,
    createdAt: new Date(),
    alias,
    before50: null,
    gospelMatins: null,
    gospelLiturgy: null as any,
    apostleLiturgy: null as any,
    updatedAt: new Date(),
});

// Извлекает чин из occasion вида "Общее X" / "Общее X, доп.уточнение" / "Общее X (...)" /
// "Общее X на литургии". "на утрене" -> null (пропускаем, отдельная будущая задача).
const extractRank = (occasion: string): string | null => {
    if (!/^Общее\s+/i.test(occasion)) return null;
    if (/на\s+утрене/i.test(occasion)) return null;
    let rank = occasion.replace(/^Общее\s+/i, "");
    rank = rank.replace(/\s*на\s+литурги[иеи]\s*$/i, "");
    rank = rank.split(",")[0];
    rank = rank.split("(")[0];
    return rank.trim();
};

const slugify = (rank: string): string => {
    const map: Record<string, string> = {
        а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
        й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
        у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
        э: "e", ю: "yu", я: "ya",
    };
    return rank
        .toLowerCase()
        .split("")
        .map(ch => map[ch] ?? (/[a-z0-9]/.test(ch) ? ch : "-"))
        .join("")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
};

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const daysCol = db.collection("days");

    // rank -> { gospel: pericope[], apostle: pericope[] }
    const byRank = new Map<string, { gospel: any[]; apostle: any[] }>();

    for (const source of ["gospel", "apostle"] as const) {
        const pericopes = await db.collection("pericopes").find({ source }).toArray();
        for (const p of pericopes) {
            for (const occasion of (p.occasions || [])) {
                const rank = extractRank(occasion);
                if (!rank) continue;
                const entry = byRank.get(rank) || { gospel: [], apostle: [] };
                if (!entry[source].some((x: any) => x._id.equals(p._id))) {
                    entry[source].push(p);
                }
                byRank.set(rank, entry);
            }
        }
    }

    let created = 0;
    let updated = 0;
    for (const [rank, { gospel, apostle }] of byRank) {
        const alias = `commons-${slugify(rank)}`;
        const name = `Общее ${rank}`;

        const toItems = (pericopes: any[]) => ({
            items: pericopes.map(p => ({
                cite: "",
                textId: null,
                pericopeId: p._id,
                paschal: false,
                description: p.label,
            })),
        });

        const existing = await daysCol.findOne({ alias });
        const update = {
            gospelLiturgy: gospel.length ? toItems(gospel) : null,
            apostleLiturgy: apostle.length ? toItems(apostle) : null,
        };

        if (existing) {
            await daysCol.updateOne({ _id: existing._id }, { $set: update });
            updated++;
        } else {
            await daysCol.insertOne({ ...emptyDayDoc(name, rank, alias), ...update });
            created++;
        }
        console.log(`${alias}: Евангелие x${gospel.length} (${gospel.map(p => p.label).join(", ")}), Апостол x${apostle.length} (${apostle.map(p => p.label).join(", ")})`);
    }

    console.log(`\nИтого: создано ${created}, обновлено ${updated}, всего чинов ${byRank.size}`);
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
