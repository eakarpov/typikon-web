import type { NeumeRenderPart } from "@znamenica/kruczie";
export type NeumeGraphicPart = NeumeRenderPart;
export interface NeumeGraphicGroup { readonly cue: readonly NeumeGraphicPart[]; readonly body: NeumeGraphicPart }
export function groupNeumeGraphics(parts: readonly NeumeGraphicPart[]): NeumeGraphicGroup[] {
    const groups: NeumeGraphicGroup[] = [];
    let cue: NeumeGraphicPart[] = [];
    for (const part of parts) {
        if (part.kind === "cue") { cue.push(part); continue; }
        if (part.kind === "separator" && cue.length) {
            for (const item of cue) groups.push({ cue: [], body: item });
            cue = [];
        }
        groups.push({ cue, body: part }); cue = [];
    }
    for (const item of cue) groups.push({ cue: [], body: item });
    return groups;
}
/** The public package owns notation parsing; this adapter only arranges its graphic parts. */
export async function getNeumeGraphics(raw: string): Promise<readonly NeumeGraphicPart[]> {
    const { renderNeumes } = await import("@znamenica/kruczie");
    return renderNeumes(raw).value!.parts;
}
