// Выгружает подтверждённые связи «акафист — святой» в правила typikon-rules.
//
// ПОЧЕМУ ЧЕРЕЗ ФАЙЛ, А НЕ ПРЯМО В БАЗУ. `data.db` — артефакт сборки: build_db.py
// удаляет его и строит заново из parsed/ и rules/. Всё, что записано в него
// руками, исчезает при следующей пересборке, и связь, размеченная вечером,
// пропала бы наутро. Поэтому подтверждённое едет в `rules/akathist_saints.yaml`,
// то есть во ВХОД сборки, а проставляет dneslov_id уже migrate_akathist.py.
//
// Тот же порядок, что у остальных ручных сведений корпуса: правится вход,
// пересобирается база (см. шапку build_db.py).
//
// Запуск:  npm run export:akathist-saints  [-- --out <путь>]
import "@/scripts/lib/env";
import fs from "node:fs";
import path from "node:path";
import clientPromise from "@/lib/mongodb";

const DEFAULT_OUT = path.resolve(process.cwd(), "..", "typikon-rules", "rules", "akathist_saints.yaml");

const quote = (s: string) => `"${String(s).replace(/"/g, '\\"')}"`;

const main = async () => {
    const argv = process.argv;
    const out = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : DEFAULT_OUT;

    const client = await clientPromise;
    const col = client.db("typikon").collection("akathist_saint_links");

    const rows = await col.find({ status: "approved" })
        .sort({ akathistId: 1 })
        .toArray();

    const pending = await col.countDocuments({ status: "pending" });
    const rejected = await col.countDocuments({ status: "rejected" });

    if (!fs.existsSync(path.dirname(out))) {
        console.error(`нет каталога ${path.dirname(out)} — проект typikon-rules не найден рядом`);
        process.exit(1);
    }

    // Пишем плоским YAML вручную: строк несколько сотен, структура — три поля,
    // и тащить в зависимости сайта библиотеку сериализации ради этого незачем.
    // Имя святого идёт КОММЕНТАРИЕМ, а не полем: истина здесь — идентификатор,
    // а имя приходит от dneslov при показе и меняться может без нашего ведома
    // (ровно поэтому в корпусе нет таблицы имён, см. src/lib/dneslov.ts).
    const lines = [
        "# Связи акафистов со святыми: akathists.dneslov_id.",
        "#",
        "# Файл СОБРАН, а не написан: его выгружает",
        "# typikon-web/src/scripts/export-akathist-saints.ts из подтверждённых в админке",
        "# связей (/admin/akathists). Править руками можно, но следующая выгрузка",
        "# перезапишет — правьте решение в админке.",
        "#",
        "# Читает его src/migrate_akathist.py при сборке корпуса.",
        `# Выгружено: ${rows.length} подтверждённых; ждут решения ${pending}, отклонено ${rejected}.`,
        "",
        "links:",
        ...rows.map((r: any) =>
            `  - akathist_id: ${quote(r.akathistId)}\n`
            + `    dneslov_id: ${quote(r.dneslovId)}\n`
            + `    # ${r.saintName || "(имя не записано)"}`),
        "",
    ];

    fs.writeFileSync(out, lines.join("\n"), "utf-8");
    console.log(`выгружено связей: ${rows.length} -> ${out}`);
    console.log(`  ждут решения: ${pending}, отклонено: ${rejected}`);
    if (!rows.length) {
        console.log("  (ни одной подтверждённой — пересоберите корпус после ревью)");
    }
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
