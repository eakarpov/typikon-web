// Даты карты славянских поселений: «9 век», «4 век до н.э.», «2 век нашей эры»,
// «862 год», «168 год до н.э.» — в годы для периодов места (@/lib/places/schema).
//
// Век даёт промежуток: начало века — год основания, конец века — год разрушения.
// Так «основан в 9 веке» не выдаёт себя за 801 год: в периоде рядом лежит исходная
// запись, а годы нужны лишь, чтобы места можно было сравнивать и сортировать.

const BC = /до\s*н\.?\s*э/i;

export interface YearSpan { from: number; to: number }

/** Промежуток лет, который обозначает запись; null — запись не разобрана. */
export const parseSpan = (raw: string | null | undefined): YearSpan | null => {
    if (!raw) return null;
    const s = raw.trim();
    const bc = BC.test(s);
    const century = s.match(/^(\d+)\s*век/i);
    if (century) {
        const n = Number(century[1]);
        return bc
            ? { from: -n * 100, to: -(n - 1) * 100 - 1 }
            : { from: (n - 1) * 100 + 1, to: n * 100 };
    }
    const year = s.match(/^(\d+)\s*год/i);
    if (year) {
        const y = Number(year[1]) * (bc ? -1 : 1);
        return { from: y, to: y };
    }
    return null;
};

/**
 * Цвета эпох прежней легенды: до V века — чёрный, с V по X — красный, с X по XIV — зелёный.
 * Здесь, а не в клиентской карте: серверная страница читает их для легенды, а значение
 * из модуля 'use client' приходит на сервер ссылкой, а не строкой.
 */
export const ERA_COLORS = { ancient: "#111827", early: "#b91c1c", medieval: "#15803d" } as const;

/** Эпоха по легенде прежней карты: до 5 века, с 5 по 10, с 10 по 14. */
export const eraOf = (from: number | undefined): "ancient" | "early" | "medieval" | null => {
    if (from === undefined) return null;
    if (from < 401) return "ancient";
    if (from < 1001) return "early";
    return "medieval";
};
