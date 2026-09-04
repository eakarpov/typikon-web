import "@/scripts/lib/env";
import { collectHealth } from "@/lib/health/collect";
import { changeSince, snapshotOf } from "@/lib/health/core";
import { lastSnapshot, saveSnapshot } from "@/lib/health/store";

// Снимок панели здоровья: числа на сегодня в базу, чтобы завтра было с чем
// сравнить. Панель показывает состояние, а этот прогон — память о нём.
//
// Запускать по расписанию (раз в неделю довольно) или руками после большой
// разметки. Ничего не пишет без --write.
//
// Запуск:  npm run health:snapshot [-- --write]

const main = async () => {
    const write = process.argv.includes("--write");
    const report = await collectHealth();
    const snapshot = snapshotOf(report);
    const previous = await lastSnapshot();

    const n = (value: number) => value.toLocaleString("ru-RU");

    for (const group of report.groups) {
        if (group.unavailable) {
            console.log(`${group.title}: ${group.unavailable}`);
            continue;
        }
        console.log(group.title);
        for (const metric of group.metrics) {
            const change = changeSince(metric, previous);
            const mark = change === null ? ""
                : change === 0 ? "  ="
                    : change > 0 ? `  +${n(change)}` : `  −${n(-change)}`;
            console.log(`  ${metric.label.padEnd(44)} ${String(n(metric.gap)).padStart(9)}${mark}`);
        }
    }

    if (previous) {
        console.log(`\nсравнение с ${new Date(previous.takenAt).toLocaleDateString("ru-RU")};`
            + " плюс значит, что недостача выросла");
    } else {
        console.log("\nпрежних снимков нет: этот будет первым");
    }

    if (!write) {
        console.log("\nпробный прогон; чтобы записать — --write");
        return;
    }

    await saveSnapshot(snapshot);
    console.log(`\nснимок записан за ${snapshot.takenAt.slice(0, 10)}`);
};

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
