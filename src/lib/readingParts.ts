/** Existing corpus delimiters; indices match the day assignment's statia selector. */
export function readingParts(content: string | null | undefined): string[] {
    if (typeof content !== "string") return [""];
    return content.includes("[Среда:]") ? content.split(/\[Среда:\]/) : content.split(/\[Статия \d+\]/);
}

export function readingStatia(content: string, statia?: number): string | null {
    const count = readingParts(content).length;
    const selected = statia == null ? 1 : Number(statia);
    if (!Number.isInteger(selected) || selected < 1) return null;
    if (count > 1) return `Статия ${selected} из ${count}`;
    return statia ? `Статия ${selected}` : null;
}
