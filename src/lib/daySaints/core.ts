// Святые дня: сборка списка по связкам «память → святой».
//
// Здесь только чистые функции — выборка из Mongo живёт в store.ts, а обработчик
// в src/app/api/v2/calendar/[date]/saints/route.ts тонкий.
import { isPersonSaint } from "@/lib/saintFacts";

/** Связка одной корпусной памяти со святым каталога (null — связь не выверена). */
export interface LinkedSaint {
    memoryId: string;
    saint: any | null;
}

/**
 * Церковное число для гражданской даты — ровно та же арифметика, что в calcDay
 * (src/lib/calcDay.ts): минус тринадцать дней, месяц и число берутся у этой даты
 * теми же геттерами. Пасхалия здесь не участвует: неподвижный круг Минеи
 * адресуется парой месяц+число ст. ст. — как и знаки месяцеслова
 * (getDayMemories). null — дата не разобралась.
 */
export const churchMonthDay = (dateStr: string): { month: number; day: number } | null => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    const church = new Date(date.getTime() - 13 * 24 * 3600 * 1000);
    return { month: church.getMonth() + 1, day: church.getDate() };
};

/**
 * Список святых дня из связок «память → святой».
 *
 * Порядок — порядок памятей в книге. Дубликаты по слугу сняты: одно лицо
 * подписано несколькими памятями (мирское и монашеское имя, лицо и перенесение
 * мощей). Записи, чей род — не лицо (икона, святыня, место, храм), опущены:
 * это список святых, и собор икон в нём — ошибка, а не расширение.
 */
export const daySaintsOf = (linked: LinkedSaint[]): any[] => {
    const seen = new Set<string>();
    const result: any[] = [];

    for (const { saint } of linked) {
        if (!saint || !isPersonSaint(saint)) continue;

        const key = saint.slug ? `slug:${saint.slug}` : `id:${String(saint._id ?? saint.name)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(saint);
    }

    return result;
};
