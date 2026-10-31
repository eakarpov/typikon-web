import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prepare } from "./dumpLayers";

// Explicit public-text scope. New languages/sources require a rights review,
// rather than silently entering the CC BY layer when the engine is rebuilt.
export const CHANT_BOOKS = ["octoechos", "menaion", "triod-postnaya", "triod-tsvetnaya", "obshaya-mineya"];
export const CHANT_CANON_PREFIXES = ["oktoih-", "mineya-", "triod-", "obshaya-"];
export const CHANT_FILES = ["chant-editions", "chant-positions", "chant-groups", "chant-canons", "chant-akathists",
    "chant-prayers", "chant-items", "chant-rubrics", "chant-links", "chant-incipits", "chant-source-keys", "chant-coverage"];

export function openChantDump(file: string) {
    if (!file) throw new Error("Нужен RULES_DB или --rules-db: певческий слой нельзя собрать без базы движка");
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        db.exec("BEGIN");
        type Row = Record<string, any>;
        const rows = (table: string, key: string) => db.prepare(`SELECT * FROM ${table} ORDER BY ${key}`).iterate() as Iterable<Row>;
        const language = (r: Row) => r.language === "cu" || r.language === "cu_gr";
        const groups = new Set([...rows("groups", "group_id")].filter(r => language(r) && CHANT_BOOKS.includes(r.source_book)).map(r => r.group_id));
        const canons = new Set([...rows("canons", "canon_id")].filter(r => language(r)
            && CHANT_CANON_PREFIXES.some(prefix => r.canon_id.startsWith(prefix))).map(r => r.canon_id));
        // Contemporary collections of akathists have no source reuse terms recorded.
        // Their titles remain catalogued by the portal, but bodies do not acquire CC BY.
        const akathists = new Set([...rows("akathists", "akathist_id")]
            .filter(r => r.source_book === "Триодь постная, суббота 5-й седмицы").map(r => r.akathist_id));
        const prayers = new Set([...rows("prayers", "prayer_id")].filter(r => language(r) && r.source_book === "menaion").map(r => r.prayer_id));
        const items = new Set<number>();
        const coverage: Row[] = [];
        const included = (r: Row) => language(r) && (groups.has(r.group_id) || canons.has(r.canon_id)
            || akathists.has(r.akathist_id) || prayers.has(r.prayer_id));
        const counts = new Map<string, { total: number; shipped: number }>();
        for (const r of rows("content_items", "item_id")) {
            const key = r.language ?? "unspecified";
            const count = counts.get(key) ?? { total: 0, shipped: 0 };
            count.total++;
            if (included(r)) { items.add(r.item_id); count.shipped++; }
            counts.set(key, count);
        }
        for (const [lang, count] of [...counts].sort(([a], [b]) => a.localeCompare(b, "en"))) {
            coverage.push({ language: lang, totalItems: count.total, shippedItems: count.shipped,
                excludedItems: count.total - count.shipped,
                reason: "Экспортируются церковнославянские тексты перечисленных книг; современные службы, переводы и сборники с неуточнёнными условиями не включены.",
                sourceBooks: CHANT_BOOKS, canonPrefixes: CHANT_CANON_PREFIXES });
        }
        if (!items.size) throw new Error("Певческий слой пуст: проверьте базу и схему");
        const specs: Record<string, [string, string, (r: Row) => boolean]> = {
            "chant-editions": ["editions", "edition_id", r => language(r) && CHANT_BOOKS.includes(r.source_book)],
            "chant-positions": ["positions", "position_id", () => true],
            "chant-groups": ["groups", "group_id", r => groups.has(r.group_id)],
            "chant-canons": ["canons", "canon_id", r => canons.has(r.canon_id)],
            "chant-akathists": ["akathists", "akathist_id", r => akathists.has(r.akathist_id)],
            "chant-prayers": ["prayers", "prayer_id", r => prayers.has(r.prayer_id)],
            "chant-items": ["content_items", "item_id", r => items.has(r.item_id)],
            "chant-rubrics": ["rubrics", "rubric_id", r => language(r) && CHANT_BOOKS.includes(r.source_book)],
            "chant-links": ["text_links", "item_id, other_item_id, kind, method", r => items.has(r.item_id) && items.has(r.other_item_id)],
            "chant-incipits": ["text_incipits", "item_id", r => items.has(r.item_id)],
            "chant-source-keys": ["source_keys", "item_id, source_book, source_key", r => items.has(r.item_id)],
        };
        const generators: Record<string, () => AsyncGenerator<any>> = {};
        for (const [name, [table, key, accept]] of Object.entries(specs)) {
            const statement = db.prepare(`SELECT * FROM ${table} ORDER BY ${key}`);
            generators[name] = async function* () {
                for (const row of statement.iterate() as Iterable<Row>) if (accept(row)) yield prepare(row);
            };
        }
        generators["chant-coverage"] = async function* () { for (const r of coverage) yield prepare(r); };
        return { generators, close: () => db.close() };
    } catch (error) { db.close(); throw error; }
}

/** Our catalogue and provenance only: no external source bodies or npm model. */
export function witnessDump(root: string): Record<string, () => AsyncGenerator<any>> {
    const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
    const collection = JSON.parse(readFileSync(join(root, "collection.json"), "utf8"));
    const records = [...manifest.records].sort((a, b) => a.id.localeCompare(b.id, "en"));
    return {
        "witness-works": async function* () {
            for (const w of [...collection.works].sort((a, b) => a.id.localeCompare(b.id, "en"))) {
                yield prepare({ id: w.id, canonicalCode: w.canonicalCode, genre: w.genre, aliases: w.aliases });
            }
        },
        "witness-sources": async function* () {
            for (const r of records) yield prepare({ id: r.id, sourceId: r.sourceId, chantId: r.chantId,
                chantAliases: r.chantAliases, url: r.url, sourceUrl: r.sourceUrl, sourceTitle: r.sourceTitle,
                tradition: r.tradition, tone: r.tone, genre: r.genre, sha256: r.sha256,
                transcription: r.transcription, rightsUrl: r.rightsUrl, sourceLicense: r.license,
                snapshot: manifest.snapshot, collectionVersion: collection.version });
        },
    };
}
