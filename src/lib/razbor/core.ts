import { hasColonMarkup } from "@/lib/tunes/syllables";
import { mixedScript } from "@/lib/podobny/core";
import { normalizeIncipitQuery } from "@/lib/incipits";
import type { LineFlag } from "@/lib/razbor/labels";

// Разбор набранного текста: что это за строки и что с ними не так.
//
// ДЛЯ ТОГО, КТО НАБИРАЕТ, а не для того, кто читает. Приходский наборщик
// перепечатывает последование из книги, и у него нет ничего: ни сверки с
// собранием, ни словаря ударений, ни способа узнать, что строка набрана с
// опечаткой. Собрание всё это имеет и до сих пор держало при себе.
//
// ЧТО ЗДЕСЬ НЕ ДЕЛАЕТСЯ. Ударения не расставляются: для этого есть /accents,
// и делать то же самое дважды незачем — отсюда туда ведёт ссылка. Цитаты
// Писания не ищутся: сличитель живёт в соседнем проекте на Python и работает
// по указателю n-грамм, которого у веба нет; обещать это здесь было бы
// обещанием того, чего мы не умеем.

/** Одна набранная строка и что о ней известно. */
export type { LineFlag };

export interface LineReport {
    /** Номер строки в присланном тексте, считая с единицы. */
    n: number;
    text: string;
    /** Ключ зачина: первые шесть слов, приведённые к виду указателя. */
    key: string;
    flags: LineFlag[];
}

const ACCENT = /[̀́̑]/;

/**
 * Разбивка на строки.
 *
 * Строкой считаем строку, а не предложение: набирают богослужебный текст
 * построчно, и косая черта книги — тоже разрыв. Пустые выбрасываем, но номер
 * ведём по исходному тексту: человек ищет у себя в редакторе двадцать вторую
 * строку, а не двадцать вторую непустую.
 */
export const splitLines = (text: string): Array<{ n: number; text: string }> =>
    text.split(/\r?\n/)
        .map((line, i) => ({ n: i + 1, text: line.trim() }))
        .filter(line => line.text.length > 0);

export const flagsOf = (
    line: string, seen: Map<string, number>,
): LineFlag[] => {
    const flags: LineFlag[] = [];
    const words = line.split(/\s+/).filter(Boolean);

    if (mixedScript(line)) flags.push("mixed-script");
    if (!ACCENT.test(line.normalize("NFD"))) flags.push("no-accents");
    if (!hasColonMarkup(line)) flags.push("no-colons");
    if (words.length < 3) flags.push("too-short");

    const key = normalizeIncipitQuery(line);
    if (key && (seen.get(key) ?? 0) > 1) flags.push("repeated");

    return flags;
};

/** Разбор строк без обращения к собранию: всё, что видно в самом тексте. */
export const readLines = (text: string): LineReport[] => {
    const lines = splitLines(text);

    // Повторы считаем по ключу зачина, а не по строке: «Го́споди, поми́луй» и
    // «Господи помилуй» — одна и та же строка, набранная дважды по-разному.
    const seen = new Map<string, number>();
    for (const line of lines) {
        const key = normalizeIncipitQuery(line.text);
        if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
    }

    return lines.map(line => ({
        n: line.n,
        text: line.text,
        key: normalizeIncipitQuery(line.text),
        flags: flagsOf(line.text, seen),
    }));
};
