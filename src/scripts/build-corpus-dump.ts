// Собирает выгрузку корпуса: то, что проект отдаёт наружу целиком и разом.
//
// Зачем. Корпус под CC BY 4.0, но взять его было неоткуда: постранично мы просим не
// ходить, а публичный API отмерен тридцатью запросами в минуту — три тысячи текстов
// и полтораста тысяч стихов так забираются сутками. Получалось, что мы говорим
// «не выкачивайте, есть законный путь», а законного пути нет.
//
// Что получается. Каталог со слоями (corpus, bible, temples), в каждом — файлы
// <имя>.jsonl.gz по строке на запись, свой LICENSE и README, а сверху manifest.json
// с числом записей, размерами, контрольными суммами и условиями на каждый файл.
// JSONL, а не дамп Mongo: дамп читается только Mongo и везёт наружу нашу схему
// вместе с её случайностями, а строка JSON читается чем угодно.
//
// Разбор по правам — в src/scripts/lib/dumpLayers.ts. Сборка ОСТАНАВЛИВАЕТСЯ, если в
// базе завелась коллекция, которую никто не отнёс ни к слою, ни к исключённым:
// молчание не значит «можно выкладывать».
//
// Файлы воспроизводимы: ключи сортируются, записи идут по _id, времени сборки внутрь
// не пишется. Две сборки на одной базе дают одинаковые контрольные суммы, поэтому
// выгрузки можно сверять, а не перезаливать вслепую.
//
// Запуск:
//   npm run corpus:dump                     # в data-dump/
//   npm run corpus:dump -- --out путь       # в другое место
import "@/scripts/lib/env";
import { createHash } from "node:crypto";
import { copyFileSync, createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { join } from "node:path";
import clientPromise from "@/lib/mongodb";
import { addContent, createDraft, finalize } from "@/lib/accents/core";
import { BIBLE_CANON } from "@/utils/bibleCanon";
import { readChurchSlavonicCorpus } from "@/scripts/lib/corpus";
import {
    CITATION,
    DumpCollection,
    DumpLayer,
    DumpLicense,
    EXCLUDED,
    LAYERS,
    prepare,
    unclassified,
} from "@/scripts/lib/dumpLayers";

/** Полные тексты чужих лицензий — их GPL требует передавать вместе с работой. */
const LICENSE_SOURCE = "licenses";

// Новый Завет — три раздела канона; всё прочее Ветхий. Нужно ради греческого
// издания: половины его взяты из разных мест и расходятся в правах.
//
// Ветхий отбирается ОТРИЦАНИЕМ («всё, что не Новый»), а не перечислением своих книг,
// и это не стилистика. В греческом издании есть девять книг, которых нет в
// славянском каноне вовсе — Оды, 4 Маккавейская, Еноха, Псалмы Соломона, Даниил и
// Сусанна по Септуагинте, Товит по Синайскому списку. Перечисление канонических
// книг выбросило бы их молча: 2 034 стиха, которые есть только здесь и ради которых
// греческое издание отчасти и держат.
const NT_SECTIONS = new Set(["gospel", "apostle", "revelation"]);
const NT_CANON_IDS = BIBLE_CANON
    .filter((book) => NT_SECTIONS.has(book.section))
    .map((book) => book.id);

const testamentFilter = (testament: "ot" | "nt") => (testament === "nt"
    ? { canonId: { $in: NT_CANON_IDS } }
    : { canonId: { $nin: NT_CANON_IDS } });

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const OUT = outIndex >= 0 ? args[outIndex + 1] : "data-dump";

interface FileReport {
    file: string;
    title: string;
    records: number;
    bytes: number;
    sha256: string;
    dropped?: Record<string, string>;
    note?: string;
    /** Своя лицензия файла, если она не та, что у слоя. */
    license?: DumpLicense;
    attribution?: string;
}

/**
 * Пишет поток документов в <file>.jsonl.gz и считает контрольную сумму по пути,
 * не собирая содержимое в память: одна только Библия — сто пятьдесят тысяч записей.
 */
const writeCollection = async (
    dir: string,
    file: string,
    docs: AsyncIterable<any>,
): Promise<{ records: number; bytes: number; sha256: string }> => {
    const path = join(dir, `${file}.jsonl.gz`);
    let records = 0;
    let bytes = 0;

    const hash = createHash("sha256");
    const gzip = createGzip({ level: 9 });
    const out = createWriteStream(path);

    // Uint8Array, а не Buffer: тот же объект, но createHash в наших типах Node
    // принимает именно его, и лишнего приведения не нужно.
    gzip.on("data", (chunk: Uint8Array) => {
        hash.update(chunk);
        bytes += chunk.length;
    });

    const lines = async function* () {
        for await (const doc of docs) {
            records += 1;
            yield `${JSON.stringify(doc)}\n`;
        }
    };

    await pipeline(Readable.from(lines()), gzip, out);

    return { records, bytes, sha256: hash.digest("hex") };
};

const layerReadme = (layer: DumpLayer, files: FileReport[]) => {
    const rows = files
        .map((f) => `| \`${f.file}.jsonl.gz\` | ${f.title} | ${f.records.toLocaleString("ru-RU")} `
            + `| ${f.license ? `**${f.license.id}**` : layer.license.id} |`)
        .join("\n");

    const pointers = (layer.pointers || [])
        .map((p) => `### ${p.what}\n\n${p.why}\n\n${p.where}\n`)
        .join("\n");

    const dropped = files
        .filter((f) => f.dropped)
        .map((f) => {
            const lines = Object.entries(f.dropped!)
                .map(([field, why]) => `  - \`${field}\` — ${why}`)
                .join("\n");
            return `- **${f.file}**\n${lines}`;
        })
        .join("\n");

    const notes = files
        .filter((f) => f.note)
        .map((f) => `- **${f.file}** — ${f.note}`)
        .join("\n");

    return [
        `# ${layer.title}`,
        "",
        `**Лицензия:** ${layer.license.name} (${layer.license.id}) — ${layer.license.url}`,
        "",
        `**Как ссылаться:** ${layer.attribution}`,
        "",
        "## Почему условия такие",
        "",
        layer.rationale,
        "",
        "## Файлы",
        "",
        "Формат — JSON Lines, сжатый gzip: одна запись в строке.",
        "",
        "| файл | что внутри | записей | условия |",
        "|---|---|---|---|",
        rows,
        "",
        "Где в колонке условий стоит не лицензия слоя — файл идёт на СВОИХ условиях,",
        "и полный их текст лежит здесь же. Смотрите LICENSE.txt.",
        "",
        notes ? `## Замечания\n\n${notes}` : null,
        dropped ? `## Поля, снятые перед выгрузкой\n\n${dropped}` : null,
        pointers ? `## Чего здесь нет и где это взять\n\n${pointers}` : null,
        // Пустые строки здесь — разделители абзацев, а не мусор: отфильтруй их
        // заодно с необязательными разделами, и markdown склеит заголовок с текстом.
    ].filter((part) => part !== null).join("\n");
};

const rootReadme = (layers: { layer: DumpLayer; files: FileReport[] }[], builtAt: string) => [
    "# Выгрузка корпуса «Уставные чтения»",
    "",
    `Собрана ${builtAt}. Источник — https://www.typikon.su`,
    "",
    "Слои лежат отдельно, потому что условия у них РАЗНЫЕ. Прежде чем брать —",
    "прочтите LICENSE и README в каталоге слоя; общей лицензии у выгрузки нет.",
    "",
    ...layers.map(({ layer, files }) => {
        const records = files.reduce((sum, f) => sum + f.records, 0);
        return `- **${layer.id}/** — ${layer.title}. ${layer.license.id}, `
            + `${files.length} файлов, ${records.toLocaleString("ru-RU")} записей.`;
    }),
    "",
    "## Чего здесь нет",
    "",
    "Не всё, что лежит в базе, наше. Наружу не идёт:",
    "",
    ...Object.entries(EXCLUDED).map(([name, why]) => `- \`${name}\` — ${why}`),
    "",
    "Полные условия: https://www.typikon.su/license",
    "",
    "## Полнота",
    "",
    "Корпус набирается и вычитывается вручную. У текста есть отметка готовности",
    "(`readiness`): часть вычитана, часть отекстована и ждёт сверки, часть существует",
    "только сканом. Для научной работы сверяйтесь с оригиналом — ссылка на скан есть",
    "у большинства текстов.",
    "",
    "## Контрольные суммы",
    "",
    "В `manifest.json` — sha256 каждого файла. Выгрузка воспроизводима: две сборки на",
    "одной базе дают одинаковые суммы, поэтому обновление можно проверить сверкой.",
    "",
].join("\n");

const run = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");

    // Первым делом — проверка полноты разбора. Если в базе завелась коллекция, о
    // которой в dumpLayers ничего не сказано, дальше идти нельзя: она либо уехала бы
    // наружу без условий, либо тихо пропала бы из выгрузки. Оба исхода плохи молча.
    const names = (await db.listCollections().toArray()).map((c) => c.name);
    const unknown = unclassified(names);
    if (unknown.length) {
        console.error("В базе есть коллекции, не отнесённые ни к слою, ни к исключённым:");
        unknown.forEach((name) => console.error(`  ${name}`));
        console.error("Допишите их в src/scripts/lib/dumpLayers.ts и повторите.");
        process.exit(1);
    }

    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });

    // Издания нужны и сами по себе, и чтобы отобрать стихи по коду издания.
    const editions = await db.collection("bible_editions").find({}).toArray();
    const editionById = new Map(editions.map((e) => [String(e._id), e.code as string]));
    const editionByCode = new Map(editions.map((e) => [e.code as string, e._id]));

    const bookById = new Map(
        (await db.collection("bible_books").find({}).toArray())
            .map((b) => [String(b._id), b.slug as string]),
    );

    // Вторая проверка полноты — уже не по коллекциям, а по СТРОКАМ внутри той, что
    // выгружается по частям. Деление Библии на заветы отбирает стихи запросом, и
    // ошибка в отборе не падает, а тихо недодаёт: первый заход так потерял 2 034
    // стиха девяти книг, которых нет в славянском каноне. Поэтому половины должны
    // сойтись с целым — иначе сборка останавливается.
    for (const collection of LAYERS.flatMap((layer) => layer.collections)) {
        if (!collection.testament || !collection.edition) continue;

        const editionId = editionByCode.get(collection.edition);
        if (!editionId) throw new Error(`издание ${collection.edition} в базе не найдено`);

        const verses = db.collection(collection.source!);
        const total = await verses.countDocuments({ editionId });
        const parts = await Promise.all((["ot", "nt"] as const).map(
            (half) => verses.countDocuments({ editionId, ...testamentFilter(half) }),
        ));

        const sum = parts[0] + parts[1];
        if (sum !== total) {
            throw new Error(
                `${collection.edition}: деление на заветы теряет стихи — `
                + `${parts[0]} + ${parts[1]} = ${sum}, а всего ${total}`,
            );
        }
    }

    /** Согласование нумераций: стих без текста, зато по всем изданиям сразу. */
    const concordance = async function* () {
        const cursor = db.collection("bible_verses")
            .find({}, {
                projection: {
                    editionId: 1, bookId: 1, chapter: 1, verse: 1,
                    canonId: 1, canonChapter: 1, canonVerse: 1, canonRef: 1, canonSort: 1,
                },
            })
            .sort({ _id: 1 });

        for await (const verse of cursor) {
            yield prepare({
                edition: editionById.get(String(verse.editionId)) ?? null,
                book: bookById.get(String(verse.bookId)) ?? null,
                chapter: verse.chapter,
                verse: verse.verse,
                canonId: verse.canonId,
                canonChapter: verse.canonChapter,
                canonVerse: verse.canonVerse,
                canonRef: verse.canonRef,
                canonSort: verse.canonSort,
            });
        }
    };

    const fromMongo = async function* (collection: DumpCollection) {
        const filter: Record<string, any> = {};
        if (collection.edition) {
            const id = editionByCode.get(collection.edition);
            if (!id) throw new Error(`издание ${collection.edition} в базе не найдено`);
            filter.editionId = id;
        }
        if (collection.testament) {
            Object.assign(filter, testamentFilter(collection.testament));
        }

        const cursor = db.collection(collection.source!).find(filter).sort({ _id: 1 });
        for await (const doc of cursor) yield prepare(doc, collection.drop);
    };

    /**
     * Словарь ударений по собственному корпусу. Выводится здесь, а не берётся
     * готовым из typikon-csl.accents: та коллекция дополнена словарём
     * церковнославянского, взятым со стороны, и выкладывать её под своей лицензией
     * было бы неправдой. Правило «что считать ударением» — общее с accents:build,
     * оно живёт в lib/accents/core.
     */
    const accents = async function* () {
        const corpus = await readChurchSlavonicCorpus(db);
        const draft = createDraft();
        for (const doc of corpus.docs) addContent(draft, doc.content);

        const dictionary = [...finalize(draft)]
            .sort((a, b) => a[0].localeCompare(b[0], "ru"));

        for (const [word, list] of dictionary) {
            yield {
                word,
                variants: list.map((v) => [v.index, v.mark, v.count, v.spelling]),
            };
        }
    };

    const derived: Record<string, () => AsyncGenerator<any>> = {
        "bible-concordance": concordance,
        accents,
    };

    const built: { layer: DumpLayer; files: FileReport[] }[] = [];

    for (const layer of LAYERS) {
        const dir = join(OUT, layer.id);
        mkdirSync(dir, { recursive: true });

        const files: FileReport[] = [];
        for (const collection of layer.collections) {
            const build = derived[collection.file];
            if (!collection.source && !build) {
                throw new Error(`производная выгрузка ${collection.file} нечем собрать`);
            }
            const docs = collection.source ? fromMongo(collection) : build();
            const result = await writeCollection(dir, collection.file, docs);

            files.push({
                file: collection.file,
                title: collection.title,
                records: result.records,
                bytes: result.bytes,
                sha256: result.sha256,
                dropped: collection.drop,
                note: collection.note,
                license: collection.license,
                attribution: collection.attribution,
            });

            console.log(
                `${layer.id}/${collection.file}: ${result.records.toLocaleString("ru-RU")} записей, `
                + `${(result.bytes / 1048576).toFixed(1)} МБ`,
            );
        }

        // Своя лицензия на отдельный файл — не редкость, а объявленное устройство
        // слоя, поэтому LICENSE.txt перечисляет все, какие в слое встретились.
        const own = files.filter((file) => file.license);
        const ownLines = own.length ? [
            "",
            "ОТДЕЛЬНЫЕ ФАЙЛЫ ИДУТ НА СВОИХ УСЛОВИЯХ:",
            "",
            ...own.flatMap((file) => [
                `  ${file.file}.jsonl.gz — ${file.license!.name} (${file.license!.id})`,
                `    ${file.license!.url}`,
                ...(file.attribution ? [`    Как ссылаться: ${file.attribution}`] : []),
                ...(file.license!.file ? [`    Полный текст лицензии: ${file.license!.file}`] : []),
                "",
            ]),
        ] : [];

        writeFileSync(
            join(dir, "LICENSE.txt"),
            [
                `${layer.license.name} (${layer.license.id})`,
                layer.license.url,
                "",
                "Как ссылаться:",
                layer.attribution,
                ...ownLines,
            ].join("\n") + "\n",
        );

        // GPL требует передавать копию лицензии вместе с работой (§4) — ссылки мало.
        new Set(own.map((file) => file.license!.file).filter(Boolean)).forEach((name) => {
            const from = join(LICENSE_SOURCE, name!);
            if (!existsSync(from)) throw new Error(`нет текста лицензии ${from}`);
            copyFileSync(from, join(dir, name!));
        });
        writeFileSync(join(dir, "README.md"), layerReadme(layer, files));

        built.push({ layer, files });
    }

    // Дата сборки живёт ТОЛЬКО в манифесте: попади она в сами файлы, две сборки на
    // одной базе перестали бы совпадать побайтово и сверять выгрузки было бы нечем.
    const builtAt = new Date().toISOString().slice(0, 10);

    const manifest = {
        name: "Выгрузка корпуса «Уставные чтения»",
        source: "https://www.typikon.su",
        builtAt,
        citation: CITATION,
        licenseUrl: "https://www.typikon.su/license",
        layers: built.map(({ layer, files }) => ({
            id: layer.id,
            title: layer.title,
            license: layer.license,
            attribution: layer.attribution,
            rationale: layer.rationale,
            files: files.map((f) => ({
                path: `${layer.id}/${f.file}.jsonl.gz`,
                title: f.title,
                records: f.records,
                bytes: f.bytes,
                sha256: f.sha256,
                // Лицензия у файла своя только когда она НЕ та, что у слоя: пусть
                // разница бросается в глаза, а не тонет в повторе.
                ...(f.license ? { license: f.license } : {}),
                ...(f.attribution ? { attribution: f.attribution } : {}),
                ...(f.dropped ? { droppedFields: f.dropped } : {}),
                ...(f.note ? { note: f.note } : {}),
            })),
            ...(layer.pointers ? { notShipped: layer.pointers } : {}),
        })),
        excluded: EXCLUDED,
    };

    writeFileSync(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(join(OUT, "README.md"), rootReadme(built, builtAt));

    const records = built.reduce((sum, b) => sum + b.files.reduce((s, f) => s + f.records, 0), 0);
    const bytes = built.reduce((sum, b) => sum + b.files.reduce((s, f) => s + f.bytes, 0), 0);
    console.log(
        `\nГотово: ${records.toLocaleString("ru-RU")} записей, `
        + `${(bytes / 1048576).toFixed(1)} МБ в ${OUT}/`,
    );

    await client.close();
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
