import { createHash } from 'node:crypto';
import { openSync, readSync, closeSync } from 'node:fs';
/** Bounded memory, including SQLite artifacts larger than Node's maximum Buffer size. */
export function hashFile(file: string, chunkBytes = 1024 * 1024): string {
    if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 16 * 1024 * 1024) throw new Error('Invalid hash chunk size');
    const fd = openSync(file, 'r');
    try {
        const hash = createHash('sha256'), chunk = Buffer.allocUnsafe(chunkBytes);
        for (;;) { const bytes = readSync(fd, chunk, 0, chunk.length, null); if (!bytes) break; hash.update(chunk.subarray(0, bytes)); }
        return hash.digest('hex');
    } finally { closeSync(fd); }
}
