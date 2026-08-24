import { createHash } from "node:crypto";

// Учёт посещений устроен из трёх частей, и вот почему.
//
// Раньше всё лежало одной коллекцией logs: строка на пару (посетитель, адрес).
// На проде таких строк накопилось 95 тысяч, а метрика при этом считалась так:
// загрузить ВСЕ документы в память и сложить в JS. Это дорого и растёт линейно.
//
// Теперь:
//   * logs      — подробности по парам (ipHash, url), их можно чистить и сворачивать;
//   * summaries — свёрнутая история: один документ на месяц с суммой просмотров;
//   * visitors  — по документу на посетителя, чтобы «сколько всего посетителей»
//                 оставалось точным независимо от того, что мы вычистили из logs.
//
// Благодаря visitors подробные строки можно удалять без потери обеих цифр.

export const VISITS_DB = "typikon-meta";
export const LOGS = "logs";
export const VISITORS = "visitors";

// Сколько последних отметок времени храним в подробной записи.
export const VISIT_TIMESTAMPS_KEPT = 50;

export const hashIp = (ip: unknown): string => {
    const salt = process.env.META_HASH_SALT || process.env.SESSION_SECRET || "";
    return createHash("sha256").update(`${salt}:${String(ip ?? "")}`).digest("hex").slice(0, 16);
};

// В базе адреса лежали целиком, вместе со схемой и хостом
// («http://localhost:3000/penticostarion»), поэтому один и тот же раздел
// размножался по строкам: http и https, с www и без, с параметрами и без.
// Для счётчика значим только путь.
export const normalizeUrl = (raw: unknown): string => {
    const value = String(raw ?? "").trim();
    if (!value) return "/";

    let path = value;
    try {
        path = new URL(value).pathname;
    } catch {
        // Не абсолютный адрес — берём то, что есть, до знака вопроса.
        path = value.split("?")[0].split("#")[0];
    }

    path = path.split("?")[0].split("#")[0];
    if (!path.startsWith("/")) path = `/${path}`;
    if (path.length > 1) path = path.replace(/\/+$/, "");

    return path || "/";
};

export const monthKey = (date: Date): string =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
