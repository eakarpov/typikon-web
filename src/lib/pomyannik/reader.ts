import { UNGROUPED } from './groupPriority';
import type { PomyannikPerson } from "./types";

export interface ReadingPlace { personId: string; group: string; kind: "all" | "living" | "departed" }
export const cleanReadingPlace = (raw: unknown): ReadingPlace | null => {
    if (!raw || typeof raw !== "object") return null;
    const value = raw as Record<string, unknown>;
    if (typeof value.personId !== "string" || !/^[a-f0-9]{24}$/i.test(value.personId)
        || typeof value.group !== "string" || value.group.length > 40
        || !["all", "living", "departed"].includes(String(value.kind))) return null;
    return { personId: value.personId, group: value.group, kind: value.kind as ReadingPlace["kind"] };
};
export const readingPersons = (persons: PomyannikPerson[], group: string, kind: ReadingPlace["kind"]) =>
    ["living", "departed"].flatMap(section => persons.filter(person => person.kind === section
        && (kind === "all" || person.kind === kind) && (!group || (group===UNGROUPED ? person.groups.length===0 : person.groups.includes(group)))));

export function readingWindow<T>(items:T[],at:number):{previous?:T;current?:T;next?:T}{
    if(at<0||at>=items.length)return {};
    return {previous:items[at-1],current:items[at],next:items[at+1]};
}
