// Перестраивает подготовительный период Триоди так, чтобы он резолвился по дате.
//
// Было: четыре недели (mytaria, bludnogo-syna, strasny-sud, syrnaja) с одинаковой парой
// {type: "Triodion", value: 0}. Различить их поиском по (value, type) невозможно, а
// getWeekAndDay тип "Triodion" вообще не выдавал — поэтому на /calculator за эти даты
// Триодь не показывалась.
//
// Стало:
//   value 0 — Неделя о мытаре и фарисее (одна, воскресенье с индексом 7)
//   value 1 — 34-я седмица по Пятидесятнице (Пн–Сб, индексы 1–6) + Неделя о блудном сыне (7)
//   value 2 — мясопустная седмица целиком (1–6) + Неделя мясопустная (7)
//   value 3 — сырная седмица целиком (1–6) + Неделя сыропустная (7)
// Дальше начинается Fast(1) — первая седмица Великого поста.
//
// Будничные дни, лежавшие в mytaria под индексами 1–6, переезжают в 34-ю седмицу: в
// Евангелии этот отрезок так и называется. Содержимое дней не трогается.
//
// Скрипт идемпотентный: повторный прогон видит, что всё уже на местах, и ничего не делает.
//
// Запуск:
//   npx tsx src/scripts/fix-triodion-preparatory-weeks.ts           # план
//   npx tsx src/scripts/fix-triodion-preparatory-weeks.ts --apply   # применить
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { revalidateContent } from "@/scripts/lib/revalidate";

const APPLY = process.argv.includes("--apply");

const NEW_WEEK = {
    alias: "sedmica-34-po-pjatidesjatnice",
    label: "34-я седмица по Пятидесятнице",
    type: "Triodion",
    value: 1,
    penticostration: false,
    triodion: true,
};

// Дни переезжают под новое имя недели, поэтому и называться должны по ней:
// «Понедельник седмицы после Недели о мытаре и фарисее» -> «Понедельник 34-й седмицы
// по Пятидесятнице». День недели в начале не трогаем — в разных седмицах он написан
// по-разному («Четверг» против «Четверток»), и приводить это к одному виду — отдельный
// разговор, не для миграции структуры.
const OLD_TAIL = /\s*(седмицы\s+)?после Недели о мытаре и фарисее$/;
const NEW_TAIL = " 34-й седмицы по Пятидесятнице";

const renameWeekdays = async (days: any, weekId: any) => {
    const inWeek = await days.find({ weekId }).project({ name: 1, weekIndex: 1 }).toArray();
    const toRename = inWeek.filter((d: any) => OLD_TAIL.test(d.name ?? ""));

    if (!toRename.length) {
        note("названия дней уже приведены к новой неделе");
        return;
    }

    for (const day of toRename.sort((a: any, b: any) => (a.weekIndex ?? 0) - (b.weekIndex ?? 0))) {
        const next = day.name.replace(OLD_TAIL, NEW_TAIL);
        note(`переименовать [${day.weekIndex}] «${day.name}» → «${next}»`);
        if (APPLY) {
            await days.updateOne({ _id: day._id }, { $set: { name: next, updatedAt: new Date() } });
        }
    }
};

const plan: string[] = [];
const note = (line: string) => {
    plan.push(line);
    console.log(`  ${line}`);
};

async function main() {
    const client = await clientPromise;
    const db = client.db("typikon");
    const weeks = db.collection("weeks");
    const days = db.collection("days");

    const mytaria = await weeks.findOne({ alias: "mytaria" });
    const bludnogo = await weeks.findOne({ alias: "bludnogo-syna" });
    const meatfare = await weeks.findOne({ alias: "strasny-sud" });
    const cheesefare = await weeks.findOne({ alias: "syrnaja" });

    if (!mytaria || !meatfare || !cheesefare) {
        console.error("Не нашёл подготовительные недели — база не та или миграция уже меняла алиасы.");
        process.exit(1);
    }

    const existingNew = await weeks.findOne({ alias: NEW_WEEK.alias });
    const alreadyRestructured = Boolean(existingNew) && !bludnogo;

    console.log("План перестройки:\n");

    if (alreadyRestructured) {
        note("недели уже перестроены — остаётся только проверить названия дней");
        await renameWeekdays(days, existingNew!._id);
        if (APPLY) await revalidateContent();
        process.exit(0);
    }

    // --- 1. 34-я седмица: будни из mytaria + воскресенье из bludnogo-syna
    const mytariaDays = await days.find({ _id: { $in: mytaria.days ?? [] } })
        .project({ name: 1, weekIndex: 1 }).toArray();
    const weekdays = mytariaDays.filter((d) => (d.weekIndex ?? 0) >= 1 && (d.weekIndex ?? 0) <= 6);
    const sunday = mytariaDays.find((d) => (d.weekIndex ?? 0) === 0 || (d.weekIndex ?? 0) === 7);

    if (!sunday) {
        console.error("В mytaria не нашлось воскресного дня — прерываюсь, чтобы не потерять день.");
        process.exit(1);
    }

    note(`создать неделю «${NEW_WEEK.label}» (${NEW_WEEK.alias}), value ${NEW_WEEK.value}`);
    weekdays
        .sort((a, b) => (a.weekIndex ?? 0) - (b.weekIndex ?? 0))
        .forEach((d) => note(`  перенести [${d.weekIndex}] ${d.name}`));

    const bludnogoDays = bludnogo
        ? await days.find({ _id: { $in: bludnogo.days ?? [] } }).project({ name: 1, weekIndex: 1 }).toArray()
        : [];
    bludnogoDays.forEach((d) => note(`  перенести «${d.name}» и поставить индекс 7`));

    // --- 2. Неделя о мытаре остаётся одна, воскресенье получает индекс 7
    note(`«${sunday.name}» остаётся одна в неделе mytaria (value 0), индекс ${sunday.weekIndex} → 7`);

    // --- 3. Переномерация остальных
    note(`мясопустная седмица (strasny-sud): value ${meatfare.value} → 2`);
    note(`сырная седмица (syrnaja): value ${cheesefare.value} → 3`);
    if (bludnogo) note(`удалить опустевшую неделю «${bludnogo.label}» (${bludnogo.alias})`);

    if (!APPLY) {
        console.log(`\nНичего не изменено. Для применения: --apply`);
        process.exit(0);
    }

    console.log(`\nПрименяю...`);

    const newWeekId = existingNew?._id ?? (await weeks.insertOne({
        ...NEW_WEEK,
        days: [],
        updatedAt: new Date(),
    })).insertedId;

    const movedIds: ObjectId[] = [];

    for (const day of weekdays) {
        await days.updateOne({ _id: day._id }, { $set: { weekId: newWeekId, updatedAt: new Date() } });
        movedIds.push(day._id);
    }
    for (const day of bludnogoDays) {
        await days.updateOne(
            { _id: day._id },
            { $set: { weekId: newWeekId, weekIndex: 7, updatedAt: new Date() } },
        );
        movedIds.push(day._id);
    }

    await weeks.updateOne({ _id: newWeekId }, { $set: { days: movedIds, updatedAt: new Date() } });

    await days.updateOne({ _id: sunday._id }, { $set: { weekIndex: 7, updatedAt: new Date() } });
    await weeks.updateOne({ _id: mytaria._id }, { $set: { days: [sunday._id], value: 0, updatedAt: new Date() } });

    await weeks.updateOne({ _id: meatfare._id }, { $set: { value: 2, updatedAt: new Date() } });
    await weeks.updateOne({ _id: cheesefare._id }, { $set: { value: 3, updatedAt: new Date() } });

    if (bludnogo) {
        await weeks.deleteOne({ _id: bludnogo._id });
    }

    await renameWeekdays(days, newWeekId);

    await revalidateContent();

    console.log(`Готово. Перенесено дней: ${movedIds.length}.`);
    console.log(`Проверить: /triodion и /calculator на даты подготовительного периода.`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
