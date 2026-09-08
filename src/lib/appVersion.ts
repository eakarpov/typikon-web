import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * Какая версия приложения выложена.
 *
 * **Спрашиваем у самого выпуска, а не у числа, записанного рядом.** Приложение
 * скачивается файлом с этого же сайта (`/app/app.apk`), а рядом с ним лежит
 * именованный архив: `app-1.4.0.apk`, `app-2.0.0.apk`. Имя файла и есть версия,
 * и разойтись с тем, что человек скачает, оно не может — в отличие от числа,
 * которое надо не забыть поправить в чужом репозитории.
 *
 * До сих пор именно так и было: ручка `/api/v1/app/version` отдавала зашитые в
 * код `{major, minor}`, и держались они верными только тем, что о них помнили.
 * Версия приложения лежала в трёх местах разом — `pubspec.yaml`, `version.dart`
 * и этот обработчик, — и сходились они вручную.
 *
 * `package.json` сюда не годится совсем: в нём версия САЙТА (1.2.x), а не
 * приложения (2.0.0). Взяв её, мы сказали бы всем установленным копиям, что
 * новее их ничего нет.
 */

/** Куда сложены выпуски. Тот же каталог, из которого их и скачивают. */
const RELEASES = path.join(process.cwd(), "public", "app");

/**
 * Последнее известное — на случай, если каталога не видно (иная раскладка
 * выкладки, права, сборка без `public`). Молчать нельзя: ручка версии — это
 * то, чем приложение узнаёт о новой версии, в том числе о той, что чинит
 * поломку. Число здесь — пол, а не истина; правится при выпуске, если каталог
 * почему-то читать перестали.
 */
export const LAST_KNOWN: AppVersion = { major: 2, minor: 0, patch: 0 };

export interface AppVersion {
    major: number;
    minor: number;
    patch: number;
}

const NAME = /^app-(\d+)\.(\d+)\.(\d+)\.apk$/;

/** Больше ли первая. Номер версии — тройка, и сравнивается она как тройка. */
const newer = (a: AppVersion, b: AppVersion): boolean =>
    a.major !== b.major ? a.major > b.major
        : a.minor !== b.minor ? a.minor > b.minor
            : a.patch > b.patch;

/**
 * Разбирает имена выпусков и возвращает старший.
 *
 * `app.apk` без номера нарочно пропускается: это копия последнего, и версии в
 * себе не несёт. Всё, что не легло на шаблон, пропускается молча — каталог
 * общий, и посторонний файл в нём не повод отказать в ответе.
 */
export const latestOf = (names: string[]): AppVersion | null => {
    let found: AppVersion | null = null;

    for (const name of names) {
        const m = NAME.exec(name);
        if (!m) continue;

        const version = { major: +m[1], minor: +m[2], patch: +m[3] };
        if (!found || newer(version, found)) found = version;
    }

    return found;
};

// Чтение каталога дёшево, но ручку зовёт каждое устройство по своему
// расписанию; минуты памяти хватает, чтобы не ходить в файловую систему на
// каждый запрос, и мало, чтобы выпуск ждал ответа.
let cached: { at: number; version: AppVersion } | null = null;
const TTL = 60_000;

export const publishedVersion = (now: number = Date.now()): AppVersion => {
    if (cached && now - cached.at < TTL) return cached.version;

    let version: AppVersion;
    try {
        version = latestOf(readdirSync(RELEASES)) ?? LAST_KNOWN;
    } catch {
        version = LAST_KNOWN;
    }

    cached = { at: now, version };
    return version;
};

/** Только для тестов: сбросить память между проверками. */
export const forgetPublishedVersion = () => {
    cached = null;
};

export const versionLabel = (v: AppVersion): string => `${v.major}.${v.minor}.${v.patch}`;
