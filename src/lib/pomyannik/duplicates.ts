import type { PomyannikPerson } from "./types";
const key = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^\p{L}]/gu, "");
type Named = Pick<PomyannikPerson, "name" | "churchName" | "id">;
export const duplicateCandidates = (person: Named, persons: PomyannikPerson[]) => {
    const names = new Set([person.name, person.churchName ?? ""].map(key).filter(Boolean));
    return persons.filter(other => (!person.id || other.id !== person.id)
        && [other.name, other.churchName ?? ""].some(name => names.has(key(name))));
};

/** Считаем совпадения за один проход по именам; без попарного сравнения всей книги. */
export const personsWithDuplicates = (persons: PomyannikPerson[]) => {
    const aliases = persons.map(person => [...new Set([person.name, person.churchName ?? ""].map(key).filter(Boolean))]);
    const counts = new Map<string, number>();
    for (const names of aliases) for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
    return persons.filter((_, index) => aliases[index].some(name => (counts.get(name) ?? 0) > 1));
};
