import type { Diagnostic } from "@znamenica/kruczie";
const messages: Record<string, string> = {
    UNMAPPED_PRIZNAK: "Признáк распознан и сохранён; его графическое начертание пока не задано.",
    UNMAPPED_NEUME_CUE: "Подобен в скобках сохранён; его графическое начертание пока не задано.",
    UNMAPPED_NEUME: "Обозначение распознано и сохранено; его графическое начертание пока не задано.",
    LAYER_ALIGNMENT: "Количество музыкальных и текстовых позиций не совпадает. Нужна явная привязка слогов.",
    RECITATION_ALIGNMENT_REQUIRED: "Для речитации нужно явно назначить нотные группы текстовым позициям.",
    UNCOVERED_INPUT: "В загруженной базе не найден полный перевод этой записи.",
    SEARCH_LIMIT: "Достигнут предел поиска; могут существовать другие варианты.",
    PHRASE_ALIGNMENT_UNAVAILABLE: "Найденные музыкальные соответствия не подтверждают заданные границы слогов.",
    PHRASE_ANCHOR_CONFLICT: "Найденные соответствия расходятся с уже записанным музыкальным слоем.",
};
export function diagnosticText(diagnostic: Diagnostic): string {
    const message = messages[diagnostic.code];
    if (!message) return diagnostic.message;
    const source = diagnostic.code.startsWith("UNMAPPED_") ? diagnostic.message.slice(diagnostic.message.indexOf(": ") + 2) : "";
    return source ? `${message} Исходник: ${source}` : message;
}
