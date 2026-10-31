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

/** Only explicit corpus boundaries; never divide a reading by guessed length. */
export function selectedStatia(content: string, value: unknown): {content:string;statia:number;total:number}|null {
    if(typeof value!=='string'||!/^\d{1,4}$/.test(value))return null;
    const statia=Number(value),parts=readingParts(content);
    return statia>=1&&statia<=parts.length&&parts[statia-1].trim()?{content:parts[statia-1],statia,total:parts.length}:null;
}
