// Заводит в каталог святых лиц Собора новомучеников и исповедников Российских.
//
// ИСТОЧНИК НАШ, А НЕ ВНЕШНИЙ. Список напечатан в Минее дополнительной и разобран
// в корпусе typikon-rules (таблицы `sobor_lica`, `sobor_lica_pamyat`). Чужого
// номера у лица нет, и заводить наш разбор в `externals` значило бы подделать
// внешний ключ, который не с чем сверять. Запись каталога здесь своя, без
// внешних ключей, а откуда она взялась — лежит в `provenance`: таблица и ключ
// корпуса, издание, напечатанная строка. Сверка с dneslov, если лицо у них
// найдётся, добавит к записи внешний ключ, а не заведёт вторую.
//
// ЧИТАЕМ КОРПУС НАПРЯМУЮ. Сайт и так открывает `data.db` через RULES_DB
// (@/lib/rulesDb); промежуточная выгрузка в JSON ничего бы не добавила.
//
// СЛУГОВ НЕ НАЗНАЧАЕМ. Публичный адрес — обещание, которое нельзя взять назад.
// Запись без слуга на сайте не показывается: указатель и карта сайта идут от
// текстов через номера dneslov, страница святого ищется по слугу.
//
// ПОВТОРЯЕМО. Запись узнаётся по паре «таблица + ключ» в `provenance`; поля,
// перечисленные в `manual`, перестройка не трогает — как в build-saints.ts.
// Лица, пропавшего из корпуса, скрипт НЕ удаляет: к записи уже могли прицепить
// связи и правки. Он о нём говорит.
//
// Запуск:  npm run saints:sobor  [-- --write]
import "@/scripts/lib/env";
import Database from "better-sqlite3";
import clientPromise from "@/lib/mongodb";

const WRITE = process.argv.includes("--write");
const TABLE = "sobor_lica";
const DERIVED = ["name", "type", "baseYear", "memoryDates"] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const churchDate = (month: number, day: number) =>
    `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`;

const main = async () => {
    const file = process.env.RULES_DB;
    if (!file) { console.error("нет RULES_DB в окружении"); process.exit(1); }
    const rules = new Database(file, { readonly: true, fileMustExist: true });
    const hasTable = rules.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(TABLE);
    if (!hasTable) {
        console.error(`в корпусе нет таблицы ${TABLE} — пересоберите typikon-rules (src/build_db.py)`);
        process.exit(1);
    }

    const lica = rules.prepare(`SELECT * FROM ${TABLE} ORDER BY seq`).all() as any[];
    const dates = new Map<string, string[]>();
    for (const d of rules.prepare("SELECT lico_id, month, day FROM sobor_lica_pamyat ORDER BY lico_id, seq").all() as any[]) {
        const list = dates.get(d.lico_id) ?? [];
        const date = churchDate(d.month, d.day);
        if (!list.includes(date)) list.push(date);
        dates.set(d.lico_id, list);
    }

    const saints = (await clientPromise).db("typikon").collection("saints");
    const byId = new Map<string, any>();
    for (const s of await saints.find({ "provenance.table": TABLE }).toArray()) {
        ((s as any).provenance ?? [])
            .filter((p: any) => p.table === TABLE)
            .forEach((p: any) => byId.set(String(p.id), s));
    }

    let created = 0, updated = 0, untouched = 0, kept = 0;
    for (const lico of lica) {
        const now = new Date();
        const data = {
            // «Анатолий (Грисюк)» — так лицо называет книга, и так его ищут
            name: lico.paren ? `${lico.name} (${lico.paren})` : lico.name,
            type: lico.is_group ? "Council" : "Identity",
            baseYear: lico.died_year ?? null,
            memoryDates: dates.get(lico.lico_id) ?? [],
        };
        const provenance = {
            table: TABLE,
            id: lico.lico_id,
            edition: lico.edition,
            chin: lico.chin,
            office: lico.office,
            text: lico.text,
            url: lico.source_url,
        };
        const current = byId.get(lico.lico_id);

        if (!current) {
            created++;
            if (WRITE) {
                await saints.insertOne({
                    slug: null,
                    ...data,
                    altNames: [],
                    title: null,
                    orders: [],
                    councils: [],
                    imageUrl: null,
                    roundelUrl: null,
                    images: [],
                    externals: [],
                    provenance: [provenance],
                    manual: [],
                    createdAt: now,
                    updatedAt: now,
                } as any);
            }
            continue;
        }

        const manual: string[] = Array.isArray(current.manual) ? current.manual : [];
        if (manual.length) kept++;
        const patch: Record<string, unknown> = {};
        DERIVED.forEach((field) => {
            if (manual.includes(field)) return;
            if (!same(current[field], data[field])) patch[field] = data[field];
        });
        const provenanceList = (current.provenance ?? []).map((p: any) =>
            p.table === TABLE && String(p.id) === lico.lico_id ? provenance : p);
        if (!same(provenanceList, current.provenance)) patch.provenance = provenanceList;

        if (!Object.keys(patch).length) { untouched++; continue; }
        updated++;
        if (WRITE) await saints.updateOne({ _id: current._id }, { $set: { ...patch, updatedAt: now } });
    }

    const inCorpus = new Set(lica.map((l) => String(l.lico_id)));
    const vanished = [...byId.keys()].filter((id) => !inCorpus.has(id));

    console.log(`лиц в корпусе: ${lica.length}`);
    console.log(`  новых записей:  ${created}`);
    console.log(`  обновлений:     ${updated}`);
    console.log(`  без изменений:  ${untouched}`);
    if (kept) console.log(`  из них с ручной правкой (её не трогали): ${kept}`);
    if (vanished.length) {
        console.log(`\nпропало из корпуса: ${vanished.length} — записи остались, решать человеку `
            + `(${vanished.slice(0, 3).join(", ")}…)`);
    }
    if (!WRITE) console.log("\nэто план. Чтобы записать, добавьте --write");
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
