#!/usr/bin/env node
// Key comes from stdin; never from process arguments or exported environment.
const fs = require('node:fs');
const crypto = require('node:crypto');

function decryptBackup(encrypted, keyInput) {
    const keys = keyInput.split(/\r?\n/).map(line => line.trim())
        .filter(line => /^(?:USER_RESTORE_ARCHIVE_KEY=)?[a-f\d]{64}$/i.test(line));
    if (keys.length !== 1) throw new Error('Expected exactly one archive key on stdin');
    const key = Buffer.from(keys[0].replace(/^USER_RESTORE_ARCHIVE_KEY=/, ''), 'hex');
    const envelope = JSON.parse(encrypted);
    if (envelope.schema !== 1 || envelope.cipher !== 'aes-256-gcm'
        || !['iv', 'tag', 'data'].every(field => typeof envelope[field] === 'string')) {
        throw new Error('Unsupported archive');
    }
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid archive header');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    // Authentication must succeed before any plaintext file is opened.
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
}

if (require.main === module) {
    try {
        const [input, output, ...extra] = process.argv.slice(2);
        if (!input || !output || extra.length) throw new Error('Expected input and output paths');
        const plaintext = decryptBackup(fs.readFileSync(input, 'utf8'), fs.readFileSync(0, 'utf8'));
        // Refuse to overwrite any existing file, including a symlink.
        fs.writeFileSync(output, plaintext, { flag: 'wx', mode: 0o600 });
        console.log('Archive authenticated; private output file created. No database was changed.');
    } catch {
        console.error('Cannot decrypt archive: check the key, archive integrity and unused output path.');
        process.exitCode = 1;
    }
}

module.exports = { decryptBackup };
