import { readFileSync } from "node:fs";
import { join } from "node:path";

// Чтение манифеста выгрузки для страницы /data.
//
// Манифест читается С ДИСКА, а не запрашивается по сети у самих себя: выгрузка
// лежит на той же машине, что и сайт, и поход через nginx к собственному адресу
// добавил бы точку отказа там, где её нет вовсе. Каталог намеренно ВНЕ каталога
// сайта — по той же причине, по какой там же лежат корпус песнопений и сборки
// приложения: `git clean -fdx` в дереве выкладки не должен уносить двадцать
// мегабайт данных молча.
//
// Раздаёт файлы nginx по адресу DUMP_URL; сайт их не отдаёт и не проксирует.

export const DUMP_DIR = process.env.DUMP_DIR || "/var/www/typikon-data";
export const DUMP_URL = process.env.DUMP_URL || "/dump";

export interface DumpFile {
    path: string;
    title: string;
    records: number;
    bytes: number;
    sha256: string;
    droppedFields?: Record<string, string>;
    note?: string;
}

export interface DumpLayerInfo {
    id: string;
    title: string;
    license: { id: string; name: string; url: string };
    attribution: string;
    rationale: string;
    files: DumpFile[];
}

export interface DumpManifest {
    name: string;
    source: string;
    builtAt: string;
    citation: string;
    licenseUrl: string;
    layers: DumpLayerInfo[];
    excluded: Record<string, string>;
}

/**
 * Манифест или null, если выгрузки на машине нет. Null — не ошибка: у страницы
 * есть что сказать и без чисел, а падать оттого, что дамп ещё не собран, ей незачем.
 */
export const readManifest = (): DumpManifest | null => {
    try {
        return JSON.parse(readFileSync(join(DUMP_DIR, "manifest.json"), "utf8"));
    } catch (e) {
        return null;
    }
};

export const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
};

export const formatCount = (count: number) => count.toLocaleString("ru-RU");

/**
 * «2 сентября 2026 года». Не toLocaleDateString как есть: он даёт «2026 г.», и во
 * фразе «Собрана 2 сентября 2026 г.. Начните с…» точка удваивается.
 */
export const formatBuiltAt = (builtAt: string) => {
    const date = new Date(builtAt);
    if (isNaN(date.getTime())) return builtAt;

    const formatted = date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
    return formatted.replace(/\s*г\.$/, " года");
};
