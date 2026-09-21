// ГДЕ Я ОСТАНОВИЛСЯ.
//
// До сих пор сайт не помнил о читателе ничего, кроме заметок и избранного: текст
// на три часа чтения открывался всякий раз с начала. Место чтения — абзац: на
// абзацы текст делит и страница (`data-paragraph-index`), и приложение, так что
// отметка понятна обоим.
//
// Здесь только форма и проверка; база — в progressService, чтобы это можно было
// проверить тестом, не поднимая соединения.

export interface ProgressMark {
    textId: string;
    /** Абзац, с которого продолжать: счёт с нуля. */
    paragraph: number;
    /** Сколько абзацев в тексте на момент отметки. */
    total: number;
}

/** Предел с запасом: самый длинный текст собрания короче на порядок. */
const MAX_PARAGRAPHS = 100_000;

const isIndex = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_PARAGRAPHS;

export const normaliseProgress = (body: unknown): ProgressMark | null => {
    if (!body || typeof body !== "object") return null;
    const { textId, paragraph, total } = body as Record<string, unknown>;
    if (typeof textId !== "string" || !/^[0-9a-f]{24}$/i.test(textId)) return null;
    if (!isIndex(paragraph) || !isIndex(total) || total < 1) return null;
    return { textId: textId.toLowerCase(), paragraph: Math.min(paragraph, total - 1), total };
};

/** Дочитано: отметка стоит на последнем абзаце. */
export const isFinished = (mark: Pick<ProgressMark, "paragraph" | "total">): boolean =>
    mark.paragraph >= mark.total - 1;

/** Доля прочитанного в процентах — для полоски, а не для отчёта. */
export const percentRead = (mark: Pick<ProgressMark, "paragraph" | "total">): number =>
    mark.total <= 1 ? 100 : Math.round((mark.paragraph / (mark.total - 1)) * 100);

/** Якорь абзаца на странице чтения. */
export const paragraphAnchor = (paragraph: number): string => `par-${paragraph}`;
