/** Chat/Markdown may escape punctuation and put a hard-break backslash on every physical line. */
export function looksLikeEscapedZnamen(raw: string): boolean {
    const lines = raw.split(/\r?\n/u).filter(line => line.length);
    return lines.length >= 4 && lines.filter(line => line.endsWith("\\")).length / lines.length > .8
        && lines.some(line => /^%код\s/u.test(line) && line.endsWith("\\"));
}
/** Explicit UI operation only; never run automatically on genuine neume notation. */
export function unescapeZnamenPaste(raw: string): string {
    return raw.replace(/\\(\r?\n)/gu, "$1").replace(/\\([\\`*_{}[\]()#+.!>~|=-])/gu, "$1");
}
