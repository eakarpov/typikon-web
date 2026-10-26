import { transposeZnamen, type NotationShift } from "./transposition";
import { looksLikeEscapedZnamen } from "./transport";
import type { Diagnostic } from "@znamenica/kruczie";
import type { ZnamenFile } from "@znamenica/kruczie/formats/znamen";

export const MAX_ZNAMEN_LENGTH = 200000;
export interface ImportedZnamen {
    raw: string;
    blockIndex: number;
}
export interface MusicLayers { notation?: string; melody?: string }
export interface ZnamenExport {
    text: string | null;
    diagnostics: readonly Diagnostic[];
}

export async function importZnamenText(raw: string): Promise<ZnamenFile> {
    if (!raw.trim() || raw.length > MAX_ZNAMEN_LENGTH) throw new Error(`Вставьте исходник znamen.ru длиной до ${MAX_ZNAMEN_LENGTH} знаков.`);
    if (looksLikeEscapedZnamen(raw)) throw new Error("Вставка содержит Markdown-экранирование: обратные косые черты в концах строк. Нажмите «Снять Markdown-экранирование» и снова разберите текст.");
    const { parseZnamen } = await import("@znamenica/kruczie/formats/znamen");
    const parsed = parseZnamen(raw);
    if (!parsed.value || !parsed.value.blocks.length) throw new Error("Музыкальные строки не найдены. Нужны директивы %з (крюки) или %н (ноты).");
    return parsed.value;
}

export async function exportZnamenText(layers: MusicLayers, source?: ImportedZnamen, shift?: NotationShift): Promise<ZnamenExport> {
    for (const value of Object.values(layers)) if (/[\r\n]/u.test(value)) throw new Error("Для экспорта фрагмента музыкальный слой должен занимать одну строку.");
    if (!layers.notation?.trim() && !layers.melody?.trim()) throw new Error("Нет музыкальной записи для экспорта.");
    const { parseZnamen, serializeZnamen, applyZnamenEdits } = await import("@znamenica/kruczie/formats/znamen");
    if (source) {
        const file = await importZnamenText(source.raw);
        const block = file.blocks[source.blockIndex];
        if (!block) throw new Error("Выбранный блок отсутствует в исходнике.");
        if (Object.entries(layers).every(([key, value]) => block[key as keyof MusicLayers] === value)) {
            const serialized = serializeZnamen(file);
            return { text: serialized.value !== null && shift?.semitones ? await transposeZnamen(serialized.value, shift) : serialized.value, diagnostics: serialized.diagnostics };
        }
        const changed = applyZnamenEdits(file, [{ blockIndex: source.blockIndex, ...layers }]);
        if (!changed.value) return { text: null, diagnostics: changed.diagnostics };
        const serialized = serializeZnamen(changed.value);
        return { text: serialized.value !== null && shift?.semitones ? await transposeZnamen(serialized.value, shift) : serialized.value, diagnostics: [...changed.diagnostics, ...serialized.diagnostics] };
    }
    const raw = [layers.notation === undefined ? null : `%з ${layers.notation}`, layers.melody === undefined ? null : `%н ${layers.melody}`]
        .filter(line => line !== null).join("\n") + "\n";
    const file = parseZnamen(raw).value!;
    const serialized = serializeZnamen(file);
    return { text: serialized.value !== null && shift?.semitones ? await transposeZnamen(serialized.value, shift) : serialized.value, diagnostics: [...file.diagnostics, ...serialized.diagnostics].filter(d => d.code !== "LAYER_ALIGNMENT") };
}
