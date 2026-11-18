/** Full readers use the portal layout; corpus rendering stays in the reading service. */
export const FULL_BOOK_ALIASES = new Set([
    "chasoslov-cs-gr", "chasoslov-fr", "chasoslov-grc", "pentecostarion-cs", "pentecostarion-cs-oldrite", "pentecostarion-ro", "lenten-triodion-cs", "lenten-triodion-ro", "octoechos-ro", "common-menaion-ka", "octoechos-cs-gr", "octoechos-ka", "octoechos-et", "sluzhebnik-cs", "common-menaion-cs", "octoechos-ja", "octoechos-fr", "octoechos-cs-oldrite", "octoechos-grc",
    "menaion-01-cs", "menaion-02-cs", "menaion-03-cs", "menaion-04-cs", "menaion-05-cs", "menaion-06-cs", "menaion-07-cs", "menaion-08-cs", "menaion-09-cs", "menaion-10-cs", "menaion-11-cs", "menaion-12-cs",
    "menaion-01-ro", "menaion-02-ro", "menaion-03-ro", "menaion-04-ro", "menaion-05-ro", "menaion-06-ro", "menaion-07-ro", "menaion-08-ro", "menaion-09-ro", "menaion-10-ro", "menaion-11-ro", "menaion-12-ro",
    "typikon-cs", "typikon-ro",
]);
export type BookSearch = Record<string, string | string[] | undefined>;
export function fullBookQuery(search: BookSearch = {}): string {
    const query = new URLSearchParams();
    for (const key of ["version", "section", "anchor", "q", "key", "script"]) {
        const value = search[key];
        if (value !== undefined) query.set(key, Array.isArray(value) ? value[0] : value);
    }
    return query.toString();
}
