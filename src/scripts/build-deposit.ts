// Готовит выгрузку к загрузке в архив, выдающий DOI.
//
// Берёт СОБРАННУЮ выгрузку (data-dump) и раскладывает её по записям архива: по
// архиву на запись, у каждой свои условия. Ничего не считает заново и в базу не
// ходит — только пересобирает готовое, поэтому запускается где угодно и когда
// угодно после `npm run corpus:dump`.
//
// Кладёт рядом с архивом текст для формы: заголовок, описание с ЧИСЛАМИ ЭТОЙ
// СБОРКИ, ключевые слова и связанные идентификаторы. Описание выводится, а не
// пишется руками, потому что руками написанное устаревает первой же пересборкой.
//
// Запуск:
//   npm run corpus:dump        # сперва собрать выгрузку
//   npm run corpus:deposit     # разложить по записям
//
// Затем: загрузить архивы, вставить текст, нажать «Опубликовать». Публикация
// необратима — опубликованную запись можно только закрыть с сохранением DOI, —
// поэтому нажимает её владелец, посмотрев на состав.
import "@/scripts/lib/env";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEPOSITS, DepositRecord, depositDescription, duplicatedLayers, unassignedLayers } from "@/scripts/lib/deposits";
import { SITE_URL } from "@/utils/site";

const args = process.argv.slice(2);
const optionOf = (name: string, fallback: string): string => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] ?? fallback : fallback;
};

const DUMP = optionOf("--dump", "data-dump");
const OUT = optionOf("--out", "deposit");

interface ManifestFile {
    path: string;
    title: string;
    records: number;
    bytes: number;
    sha256: string;
    license?: { id: string; name: string; url: string };
    attribution?: string;
    sameAs?: string;
}

interface ManifestLayer {
    id: string;
    title: string;
    license: { id: string; name: string; url: string };
    attribution: string;
    rationale: string;
    files: ManifestFile[];
}

interface Manifest {
    name: string;
    source: string;
    builtAt: string;
    version: string;
    versionUrl: string;
    doi: string | null;
    citation: string;
    licenseUrl: string;
    layers: ManifestLayer[];
    excluded: Record<string, string>;
}

const citationCff = (record: DepositRecord, version: string): string => [
    "cff-version: 1.2.0",
    'message: "Если эти данные пригодились в работе, сошлитесь на них так."',
    "type: dataset",
    `title: "${record.title}"`,
    `version: "${version}"`,
    `date-released: "${version}"`,
    ...(record.doi?.version ? [`doi: "${record.doi.version}"`] : []),
    "authors:",
    "  - family-names: Карпов",
    "    given-names: Егор",
    '    orcid: "https://orcid.org/0000-0002-2394-3373"',
    `url: "${SITE_URL}"`,
    `repository-artifact: "${SITE_URL}/dump/${version}/"`,
    `license: ${record.license.id}`,
    "",
].join("\n");

const readme = (record: DepositRecord, manifest: Manifest, description: string): string => [
    `# ${record.title}`,
    "",
    `Версия ${manifest.version}. Условия: ${record.license.name} (${record.license.id}) — ${record.license.url}`,
    "",
    description,
    "",
    "## Что внутри",
    "",
    "`manifest.json` — опись: все файлы этой записи с числом записей, размерами и sha256.",
    "Рядом с данными каждого слоя лежат его собственные LICENSE и README.",
    "",
    "## Как ссылаться",
    "",
    record.doi?.version
        ? `DOI этой версии: ${record.doi.version}`
        : `Постоянный адрес версии: ${manifest.versionUrl}`,
    "",
    `Полный состав выгрузки и прежние версии: ${SITE_URL}/data`,
    "",
].join("\n");

const run = () => {
    // Записи и слои должны сойтись ДО того, как что-то собрано: забытый слой
    // просто не попал бы в архив, и заметить это было бы негде.
    const forgotten = unassignedLayers();
    if (forgotten.length) {
        console.error(`Слои не отнесены ни к одной записи: ${forgotten.join(", ")}`);
        console.error("Допишите их в src/scripts/lib/deposits.ts и повторите.");
        process.exit(1);
    }
    const doubled = duplicatedLayers();
    if (doubled.length) {
        console.error(`Слои попали сразу в две записи: ${doubled.join(", ")}`);
        console.error("Один и тот же файл в двух архивах под разными условиями — так нельзя.");
        process.exit(1);
    }

    const manifestPath = join(DUMP, "manifest.json");
    if (!existsSync(manifestPath)) {
        console.error(`Нет ${manifestPath} — сперва соберите выгрузку: npm run corpus:dump`);
        process.exit(1);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;

    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });

    console.log(`Выгрузка версии ${manifest.version} → ${OUT}/\n`);

    for (const record of DEPOSITS) {
        const layers = manifest.layers.filter((layer) => record.layers.includes(layer.id));
        if (layers.length !== record.layers.length) {
            console.error(`В выгрузке нет слоёв записи «${record.id}» — пересоберите выгрузку`);
            process.exit(1);
        }

        const stage = join(OUT, `typikon-${record.id}-${manifest.version}`);
        mkdirSync(stage, { recursive: true });

        for (const layer of layers) {
            cpSync(join(DUMP, layer.id), join(stage, layer.id), { recursive: true });
        }

        // Манифест записи — только её слои. Общий сюда класть нельзя: он
        // перечисляет файлы, которых в этом архиве нет, и опись перестала бы
        // сходиться с содержимым.
        const own: Manifest & { partOf?: unknown } = {
            ...manifest,
            doi: record.doi?.concept ?? null,
            layers,
            partOf: {
                what: "Часть выгрузки корпуса; условия у частей разные, поэтому они выложены отдельно.",
                where: `${SITE_URL}/data`,
                records: DEPOSITS.map((other) => ({
                    id: other.id,
                    title: other.title,
                    license: other.license.id,
                    ...(other.doi?.concept ? { doi: other.doi.concept } : {}),
                })),
            },
        };
        writeFileSync(join(stage, "manifest.json"), `${JSON.stringify(own, null, 2)}\n`);

        const description = depositDescription(record, layers.map((layer) => ({
            id: layer.id,
            title: layer.title,
            files: layer.files.length,
            records: layer.files.reduce((sum, file) => sum + (file.sameAs ? 0 : file.records), 0),
            exceptions: layer.files
                .filter((file) => file.license)
                .map((file) => ({
                    path: file.path,
                    license: file.license!.id,
                    attribution: file.attribution,
                })),
        })));

        writeFileSync(join(stage, "README.md"), readme(record, manifest, description));
        writeFileSync(join(stage, "CITATION.cff"), citationCff(record, manifest.version));

        // Архив собирается zip-ом, а не в Node: пакета для этого в проекте нет, а
        // zip есть на всякой машине, где идёт выкладка (им же едет сама выгрузка).
        const archive = `${stage}.zip`;
        rmSync(archive, { force: true });
        execFileSync("zip", ["-rXq", `typikon-${record.id}-${manifest.version}.zip`, `typikon-${record.id}-${manifest.version}`], { cwd: OUT });
        rmSync(stage, { recursive: true, force: true });

        // Текст для формы — отдельным файлом рядом: его вставляют, а не читают.
        writeFileSync(join(OUT, `${record.id}-metadata.md`), [
            `# ${record.title}`,
            "",
            "Поля для формы архива. Числа — по сборке " + manifest.version + ".",
            "",
            "**Resource type:** Dataset",
            "",
            `**Title:** ${record.title}`,
            "",
            `**Title (en):** ${record.titleEn}`,
            "",
            "**Authors:** Карпов Егор Андреевич — ORCID 0000-0002-2394-3373",
            "",
            `**Version:** ${manifest.version}`,
            "",
            `**License:** ${record.license.name} (${record.license.id})`,
            "",
            `**Keywords:** ${record.keywords.join("; ")}`,
            "",
            "**Related identifiers:**",
            `- is supplement to → https://github.com/eakarpov/typikon-web`,
            `- is identical to → ${manifest.versionUrl}`,
            "",
            "**Description:**",
            "",
            description,
            "",
        ].join("\n"));

        const size = statSync(archive).size;
        const records = layers.reduce(
            (sum, layer) => sum + layer.files.reduce((s, f) => s + (f.sameAs ? 0 : f.records), 0),
            0,
        );
        console.log(
            `  ${record.id}: ${layers.map((l) => l.id).join(" + ")} — `
            + `${records.toLocaleString("ru-RU")} записей, ${(size / 1048576).toFixed(1)} МБ`,
        );
        console.log(`    архив:  ${archive}`);
        console.log(`    форма:  ${join(OUT, `${record.id}-metadata.md`)}`);
        console.log(`    условия: ${record.license.id}`);
    }

    console.log("\nДальше — руками владельца: загрузить архивы, вставить описания, опубликовать.");
    console.log("Публикация необратима: опубликованную запись можно только закрыть, но не удалить.");
    console.log("Полученные DOI вписать в src/scripts/lib/deposits.ts и пересобрать выгрузку —");
    console.log("после этого страница /data покажет их сама.");
};

run();
