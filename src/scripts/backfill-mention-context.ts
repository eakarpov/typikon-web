// Дописывает к уже проставленным упоминаниям сам фрагмент текста.
//
// Зачем: /admin/mentions переносил в texts.mentionIds только идентификатор святого,
// а найденное слово и контекст вокруг него оставались в mentionCandidates и до
// читателя не доходили. Теперь страница памяти показывает фрагмент под ссылкой
// («…показа сего святаго духа наполньшися елисаветь…»), и для связей, применённых
// до этой правки, его нужно добрать. Новые упоминания пишутся сразу с контекстом —
// см. src/pages/api/admin/mentions/apply.ts.
//
// У части текстов mentionIds проставлены руками, без кандидата в базе — им контекста
// взять неоткуда, они просто останутся ссылкой без цитаты.
//
// Запуск:
//   npx tsx src/scripts/backfill-mention-context.ts           # что будет дописано
//   npx tsx src/scripts/backfill-mention-context.ts --apply   # дописать
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { revalidateContent } from "@/scripts/lib/revalidate";

const APPLY = process.argv.includes("--apply");

async function main() {
    const client = await clientPromise;
    const db = client.db("typikon");
    const texts = db.collection("texts");

    const docs = await texts
        .find({ mentionIds: { $exists: true, $ne: [] } },
              { projection: { name: 1, mentionIds: 1, mentions: 1 } })
        .toArray();

    const candidates = await db
        .collection("mentionCandidates")
        .find({ status: "applied" })
        .toArray();

    // Ключ пары: у одного текста может быть несколько упомянутых святых.
    const byPair = new Map<string, any>();
    candidates.forEach((c) => {
        byPair.set(`${c.textId.toString()}:${c.dneslovId}`, c);
    });

    let filled = 0;
    let missing = 0;
    let touched = 0;

    for (const doc of docs) {
        const known = new Set((doc.mentions ?? []).map((m: any) => m.dneslovId));
        const additions: any[] = [];

        for (const dneslovId of doc.mentionIds as string[]) {
            if (known.has(dneslovId)) continue;

            const candidate = byPair.get(`${doc._id.toString()}:${dneslovId}`);
            if (!candidate) {
                missing++;
                console.log(`  без контекста: ${dneslovId} в «${(doc.name as string).slice(0, 60)}»`);
                continue;
            }

            additions.push({
                dneslovId,
                word: candidate.word ?? null,
                context: candidate.context ?? null,
            });
            filled++;
        }

        if (!additions.length) continue;
        touched++;

        if (APPLY) {
            await texts.updateOne(
                { _id: doc._id },
                { $push: { mentions: { $each: additions } } } as any,
            );
        }
    }

    console.log(`\nТекстов с упоминаниями: ${docs.length}`);
    console.log(`Дописано фрагментов: ${filled} в ${touched} текстах`);
    console.log(`Осталось без контекста: ${missing} (кандидата в базе нет)`);

    if (!APPLY) {
        console.log(`\nЭто предварительный прогон. Повторите с --apply, чтобы записать.`);
    } else if (touched) {
        await revalidateContent();
    }

    process.exit(0);
}

main();
