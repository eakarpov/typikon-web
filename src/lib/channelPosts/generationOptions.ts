export function generationOptions(input: { from?: unknown; daysAhead?: unknown } = {}) {
    const from = input.from ?? new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
    const daysAhead = Number(input.daysAhead ?? 3);
    if (typeof from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error("Нужна дата ГГГГ-ММ-ДД");
    const date = new Date(`${from}T00:00:00Z`);
    if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== from) throw new Error("Неверная дата");
    if (!Number.isInteger(daysAhead) || daysAhead < 0 || daysAhead > 30) throw new Error("Дней вперёд: от 0 до 30");
    return { from: date, daysAhead };
}

