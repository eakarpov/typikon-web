import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openChantDump, witnessDump, CHANT_FILES } from "./chantDump";
import { LAYERS } from "./dumpLayers";

test("отсутствующий источник не создаётся как пустая SQLite-база", () => {
    const root = mkdtempSync(join(tmpdir(), "chant-missing-")), file = join(root, "missing.db");
    try { assert.throws(() => openChantDump(file)); assert.equal(existsSync(file), false); }
    finally { rmSync(root, { recursive: true, force: true }); }
});

test("певческий слой не захватывает новые языки/современные источники и сохраняет замкнутые связи", async () => {
    const root = mkdtempSync(join(tmpdir(), "chant-dump-")), file = join(root, "rules.db");
    const db = new Database(file);
    db.exec(`
        CREATE TABLE editions(edition_id TEXT,source_book TEXT,language TEXT);
        CREATE TABLE groups(group_id TEXT, source_book TEXT, language TEXT);
        INSERT INTO groups VALUES('old','octoechos','cu_gr'),('new','patriarchia','cu_gr'),('translation','octoechos','en');
        CREATE TABLE canons(canon_id TEXT,language TEXT);
        INSERT INTO canons VALUES('mineya-old','cu_gr'),('sinod-new','cu_gr'),('unknown-new','cu_gr');
        CREATE TABLE akathists(akathist_id TEXT,source_book TEXT);
        INSERT INTO akathists VALUES('old','Триодь постная, суббота 5-й седмицы'),('new','patriarchia');
        CREATE TABLE prayers(prayer_id TEXT,language TEXT,source_book TEXT);
        INSERT INTO prayers VALUES('old','cu_gr','menaion'),('new','cu_gr','unknown');
        CREATE TABLE content_items(item_id INTEGER,group_id TEXT,canon_id TEXT,akathist_id TEXT,prayer_id TEXT,language TEXT,text TEXT);
        INSERT INTO content_items VALUES(2,NULL,'mineya-old',NULL,NULL,'cu_gr','канон'),(1,'old',NULL,NULL,NULL,'cu_gr','песнопение'),
          (3,'new',NULL,NULL,NULL,'cu_gr','не включать'),(4,'translation',NULL,NULL,NULL,'en','not shipped'),
          (5,NULL,'sinod-new',NULL,NULL,'cu_gr','не включать'),(6,NULL,NULL,'new',NULL,'cu_gr','не включать');
        CREATE TABLE positions(position_id TEXT);
        CREATE TABLE rubrics(rubric_id INTEGER,language TEXT,source_book TEXT,text TEXT);
        INSERT INTO rubrics VALUES(1,'cu_gr','octoechos','указание'),(2,'cu_gr','patriarchia','не включать');
        CREATE TABLE text_links(item_id INTEGER,other_item_id INTEGER,kind TEXT,method TEXT);
        INSERT INTO text_links VALUES(1,2,'same','manual'),(1,3,'same','manual');
        CREATE TABLE text_incipits(item_id INTEGER,text TEXT);
        INSERT INTO text_incipits VALUES(1,'песнопение'),(3,'не включать');
        CREATE TABLE source_keys(item_id INTEGER,source_book TEXT,source_key TEXT);
        INSERT INTO source_keys VALUES(1,'octoechos','key'),(3,'patriarchia','private');
    `);
    db.close();
    const dump = openChantDump(file);
    try {
        const collect = async (name: string) => { const rows = []; for await (const r of dump.generators[name]()) rows.push(r); return rows; };
        assert.deepEqual((await collect("chant-items")).map(r => r.item_id), [1, 2]);
        assert.equal((await collect("chant-links")).length, 1);
        assert.equal((await collect("chant-incipits")).length, 1);
        assert.equal((await collect("chant-rubrics")).length, 1);
        const coverage = await collect("chant-coverage");
        assert.equal(coverage.reduce((n, r) => n + r.totalItems, 0), 6);
        assert.equal(coverage.reduce((n, r) => n + r.shippedItems, 0), 2);
        assert.deepEqual(await collect("chant-items"), await collect("chant-items"));
        assert.deepEqual(Object.keys(dump.generators).sort(), [...CHANT_FILES].sort());
        assert.deepEqual(LAYERS.find(l => l.id === "chants")!.collections.map(c => c.file).sort(), [...CHANT_FILES].sort());
    } finally { dump.close(); rmSync(root, { recursive: true, force: true }); }
});

test("указатель мастерской сохраняет происхождение и не выдаёт внешние тела или модель", async () => {
    const root = mkdtempSync(join(tmpdir(), "witness-dump-"));
    writeFileSync(join(root, "manifest.json"), JSON.stringify({ snapshot: "2026-10-27", records: [
        { id: "b", url: "https://example.org/source", rightsUrl: "https://example.org/terms", license: "source terms", transcription: "Набор автора", content: "DO NOT SHIP", rawPath: "raw/b.zf" },
        { id: "a" },
    ] }));
    writeFileSync(join(root, "collection.json"), JSON.stringify({ version: "v3", works: [{ id: "work", canonicalCode: "w1", content: "DO NOT SHIP" }], model: "DO NOT SHIP" }));
    try {
        const generators = witnessDump(root), rows = [];
        for await (const r of generators["witness-sources"]()) rows.push(r);
        assert.deepEqual(rows.map(r => r.id), ["a", "b"]);
        assert.equal(rows[1].sourceLicense, "source terms");
        assert.equal(rows[1].transcription, "Набор автора");
        assert.ok(!JSON.stringify(rows).includes("DO NOT SHIP"));
        assert.ok(!JSON.stringify(rows).includes("rawPath"));
        const works = []; for await (const work of generators["witness-works"]()) works.push(work);
        assert.ok(!JSON.stringify(works).includes("DO NOT SHIP"));
    } finally { rmSync(root, { recursive: true, force: true }); }
});
