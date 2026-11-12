import type { PomyannikPerson } from "./types";

export const cleanSignature = (raw: unknown): string | null =>
    typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 120) || null : null;

const searchKey = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru").replace(/ё/g, "е").trim();

export const cleanGroups = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    const found = new Set<string>();
    return raw.flatMap(value => {
        if (typeof value !== "string") return [];
        const group = value.replace(/\s+/g, " ").trim().slice(0, 40);
        const key = searchKey(group);
        if (!key || found.has(key)) return [];
        found.add(key);
        return [group];
    }).slice(0, 10);
};

export const personMatches = (person: PomyannikPerson, query: string, group = "") => {
    if (group && !(person.groups ?? []).includes(group)) return false;
    const terms = searchKey(query).split(/\s+/).filter(Boolean);
    const text = searchKey([person.name, person.churchName, person.signature, person.relation,
        ...(person.groupNames ?? person.groups ?? [])].filter(Boolean).join(" "));
    return terms.every(term => text.includes(term));
};

/** Полная перестановка собственного списка: пропуски, повторы и чужие id запрещены. */
export const validPersonOrder = (ids: unknown, currentIds: string[]): ids is string[] => {
    if (!Array.isArray(ids) || ids.length !== currentIds.length) return false;
    const current = new Set(currentIds);
    return new Set(ids).size === ids.length
        && ids.every(id => typeof id === "string" && current.has(id));
};

/** Перемещение внутри разворота сохраняет места записей другого раздела. */
export const movePerson = (persons: PomyannikPerson[], id: string, direction: -1 | 1) => {
    const index = persons.findIndex(person => person.id === id);
    if (index < 0) return persons;
    let target = index + direction;
    while (target >= 0 && target < persons.length && persons[target].kind !== persons[index].kind) target += direction;
    if (target < 0 || target >= persons.length) return persons;
    const result = [...persons];
    [result[index], result[target]] = [result[target], result[index]];
    return result;
};
