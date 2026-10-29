/** Unknown spellings remain useful corpus keys; empty slots and placeholders do not. */
export function isCorpusNeume(raw: string): boolean {
    const groups = raw.trim().split(/~~/u);
    return groups.every(group => !!group.trim() && !/^[?._…—–-]+$/u.test(group.trim()));
}
