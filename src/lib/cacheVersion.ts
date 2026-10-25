import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export function cacheVersion(build: string, corpus: { size: number; mtimeMs: number; ctimeMs: number }, epoch = ""): string {
    if (!build.trim() || !Number.isFinite(corpus.size) || !Number.isFinite(corpus.mtimeMs) || !Number.isFinite(corpus.ctimeMs)) {
        throw new Error("Cache revision unavailable");
    }
    return createHash("sha256").update(JSON.stringify([build.trim(), corpus.size, corpus.mtimeMs, corpus.ctimeMs, epoch]))
        .digest("hex");
}

// Stat on each check detects corpus-only uploads without restarting Next.
// Never hash the entire corpus or expose filesystem paths to clients.
export async function currentCacheVersion(): Promise<string> {
    const corpusPath = process.env.RULES_DB;
    if (!corpusPath) throw new Error("Cache revision unavailable");
    const [build, corpus] = await Promise.all([
        readFile(join(process.cwd(), ".next/BUILD_ID"), "utf8"),
        stat(corpusPath),
    ]);
    return cacheVersion(build, corpus, process.env.CLIENT_CACHE_REVISION);
}
