// Грамматика адресов Писания пакета .ordo (spec/package.md, «Писание: адрес
// и резолвер»): bible:<книга>.<глава>[.<стих>[-<стих>]]. Ключи книг — те же,
// что публикует /api/v2/bible/books; номера — родные для издания, как в
// печатных зачалах. Пакет наружу Писание не кладёт — только адресует, и
// резолвит его читатель. Парсер чистый, чтобы его проверять без базы.

export interface ScriptureRef {
    canonId: string;
    chapter: number;
    /** Первый стих отрезка; null — вся глава. */
    from: number | null;
    /** Последний стих отрезка; null при одиночном стихе или всей главе. */
    to: number | null;
}

const REF = /^bible:([a-z0-9-]+)\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/i;

export const parseScriptureRef = (raw: string): ScriptureRef | null => {
    const m = REF.exec(raw.trim());
    if (!m) return null;
    const chapter = Number(m[2]);
    if (!Number.isInteger(chapter) || chapter < 1) return null;
    const from = m[3] ? Number(m[3]) : null;
    const to = m[4] ? Number(m[4]) : null;
    if (from != null && (!Number.isInteger(from) || from < 1)) return null;
    if (to != null && (!Number.isInteger(to) || to < 1)) return null;
    if (from != null && to != null && to < from) return null;
    return { canonId: m[1], chapter, from, to: to ?? null };
};
