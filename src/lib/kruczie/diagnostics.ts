import type { Diagnostic } from "@znamenica/kruczie";
const messages: Record<string, string> = {
    UNKNOWN_NEUME: "Начертание крюка пока не разобрано; это не исключает известного музыкального соответствия в корпусе.",
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

/** Reconcile catalog-only failure with all usable musical sources. Other diagnostics remain visible. */
export function musicalDiagnostics(diagnostics: readonly Diagnostic[], gaps: readonly number[]): Diagnostic[] {
    const retained = diagnostics.filter(d => !["UNCOVERED_INPUT", "INCOMPLETE_PHRASE_INPUT"].includes(d.code)).map(d => d.code === "UNKNOWN_NEUME" && !gaps.length ? { ...d, severity: "warning" as const } : d);
    if (gaps.length) retained.push({ code: "MUSICAL_GAPS", severity: "warning", message: `Нотные соответствия не найдены для позиций: ${gaps.map(p => p + 1).join(", ")}.`, details: { positions: gaps } });
    return retained;
}

/** Manual fills resolve displayed gaps without mutating the original search report. */
export function resolveMusicalGaps(diagnostics: readonly Diagnostic[], filled: readonly boolean[]): Diagnostic[] {
    return diagnostics.flatMap(d => {
        if (d.code !== "MUSICAL_GAPS" || !Array.isArray(d.details?.positions)) return [d];
        const gaps = d.details.positions.filter((p): p is number => typeof p === "number" && !filled[p]);
        return gaps.length ? musicalDiagnostics([], gaps) : [];
    });
}
