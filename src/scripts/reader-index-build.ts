import '@/scripts/lib/env';
import Database from 'better-sqlite3';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DictionaryPublication } from '@/lib/csDictionary/database';
import { ReaderService } from '@/lib/reader/service';
import { readerDb } from '@/lib/reader/registry';
import { buildIndex, type Review } from '@/lib/reader/index/store';
const arg = (key: string) => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1]; };
async function main() {
    // Local builder reads existing identity registry. It never calls publishPilot or mutates Mongo.
    const uri = new URL(process.env.MONGODB_URI ?? '');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname)) throw Error('Local builder only; use an audited release for remote publication.');
    const dictionaryPath = arg('--dictionary'), outputDir = resolve(arg('--output') ?? 'data/reader-index');
    if (!dictionaryPath) throw Error('--dictionary is required; no implicit latest dictionary');
    mkdirSync(outputDir, { recursive: true });
    const db = new Database(dictionaryPath, { readonly: true, fileMustExist: true });
    try {
        const dictionary = new DictionaryPublication(db), expected = arg('--dictionary-version');
        if (!expected || dictionary.version !== expected) throw Error('--dictionary-version must match the immutable dictionary');
        const reviews: Review[] = arg('--reviews') ? JSON.parse(readFileSync(arg('--reviews')!, 'utf8')).reviews : [];
        const result = await buildIndex(new ReaderService(await readerDb()), { outputDir, dictionary, reviews, reuse: arg('--reuse') });
        if (arg('--report')) writeFileSync(arg('--report')!, JSON.stringify(result, null, 2) + '\n');
        console.log(JSON.stringify(result, null, 2));
    } finally { db.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { const { default: client } = await import('@/lib/mongodb'); await (await client).close(); });
