import { test } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function fixture(t: { after: (fn: () => void) => void }) {
    const root = mkdtempSync(join(tmpdir(), "typikon-backup-decrypt-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const key = randomBytes(32), iv = randomBytes(12), plain = Buffer.from("private backup fixture\0\xff");
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(plain), cipher.final()]);
    const envelope = { schema: 1, cipher: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
    const input = join(root, "backup.enc"), output = join(root, "restored.tar");
    writeFileSync(input, JSON.stringify(envelope));
    const run = (keyText = `# private key\nUSER_RESTORE_ARCHIVE_KEY=${key.toString("hex")}\n`) =>
        spawnSync(process.execPath, [resolve("scripts/decrypt-users-backup.cjs"), input, output], { input: keyText, encoding: "utf8" });
    return { root, key, plain, envelope, input, output, run };
}

test("backup decrypt: authenticates binary data, accepts private env key and writes 0600", t => {
    const f = fixture(t), result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readFileSync(f.output), f.plain);
    assert.equal(statSync(f.output).mode & 0o777, 0o600);
    assert.ok(!result.stdout.includes(f.key.toString("hex")));
    assert.ok(!result.stdout.includes("private backup fixture"));
});

test("backup decrypt: a tampered ciphertext never produces a plaintext file", t => {
    const f = fixture(t), data = Buffer.from(f.envelope.data, "base64");
    data[0] ^= 1;
    writeFileSync(f.input, JSON.stringify({ ...f.envelope, data: data.toString("base64") }));
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.output), false);
});

test("backup decrypt: wrong or ambiguous keys are rejected before writing", t => {
    const f = fixture(t);
    assert.equal(f.run(randomBytes(32).toString("hex")).status, 1);
    assert.equal(f.run(`${f.key.toString("hex")}\n${f.key.toString("hex")}`).status, 1);
    assert.equal(existsSync(f.output), false);
});

test("backup decrypt: refuses to overwrite a file or a symlink target", t => {
    const f = fixture(t);
    writeFileSync(f.output, "keep");
    assert.equal(f.run().status, 1);
    assert.equal(readFileSync(f.output, "utf8"), "keep");
    rmSync(f.output);
    const target = join(f.root, "existing");
    writeFileSync(target, "keep target");
    symlinkSync(target, f.output);
    assert.equal(f.run().status, 1);
    assert.equal(readFileSync(target, "utf8"), "keep target");
});
