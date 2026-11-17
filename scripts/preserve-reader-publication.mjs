import fs from 'node:fs';
import path from 'node:path';
/** Keep the active private publication when a code-only release supplies no replacement. */
export function preserveReaderPublication(previous, candidate) {
  const read = directory => Object.fromEntries(fs.readFileSync(path.join(directory, '.env.production'), 'utf8').split(/\r?\n/).flatMap(line => {
    const match = /^(CS_READER_PUBLIC_PILOT|CS_CORPUS_INDEX_DB|CS_CORPUS_INDEX_ARCHIVE_DIR)=(.*)$/.exec(line);
    return match ? [[match[1], match[2].trim().replace(/^(["'])(.*)\1$/, '$2')]] : [];
  }));
  const active = read(previous), incoming = read(candidate), missing = {};
  for (const key of ['CS_READER_PUBLIC_PILOT', 'CS_CORPUS_INDEX_DB', 'CS_CORPUS_INDEX_ARCHIVE_DIR']) if (!(key in incoming) && key in active) missing[key] = active[key];
  const selected = { ...missing, ...incoming };
  if (selected.CS_READER_PUBLIC_PILOT === '1') {
    if (!selected.CS_CORPUS_INDEX_DB) throw Error('Reader publication requires an explicit immutable index');
    const target = path.resolve(candidate, selected.CS_CORPUS_INDEX_DB);
    if (!fs.existsSync(target) && selected.CS_CORPUS_INDEX_DB === active.CS_CORPUS_INDEX_DB) {
      const source = path.resolve(previous, active.CS_CORPUS_INDEX_DB);
      if (target.startsWith(path.resolve(candidate) + path.sep)) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL); fs.chmodSync(target, 0o444); }
    }
    if (!fs.existsSync(target)) throw Error('Reader publication artifact is missing from candidate');
  }
  if (Object.keys(missing).length) fs.appendFileSync(path.join(candidate, '.env.production'), '\n' + Object.entries(missing).map(([k, v]) => k + '=' + v).join('\n') + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) preserveReaderPublication(process.argv[2], process.argv[3]);
