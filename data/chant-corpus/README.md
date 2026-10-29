# Chant collection and source archive

Full books and transcriptions live in **typikon-web**, never in the npm package.

`znamen-v1/books/` preserves the original `.zf` files byte-for-byte in Windows-1251. `manifest.json` records public URLs, byte lengths, checksums, retrieval date, known unavailable sources and attribution/terms. Source IDs are discovered from public catalogs and manuscript signatures. The server does not expose a directory listing: the snapshot covers all available discovered books, not a provably exhaustive mirror of the site.

`znamen-v1/raw/` contains extracted double-notation witnesses in UTF-8, preserving original line endings. All other notations remain available in the archived books. `collection.json` is the typed, parsed training collection; `quality-report.json` lists excluded blocks. Extraction and training do not silently fix source notation or invent syllable alignment. `cache/` is a rebuildable HTTP cache and is ignored by Git.

```sh
npm run corpus:collect           # cached sequential collection of all discovered books
npm run corpus:collect -- --offline # repeat extraction without network
npm run corpus:collect -- --refresh # explicitly fetch a fresh snapshot
npm run corpus:build             # offline validation, extraction and N-gram training
```

Node.js 22+ is used for TypeScript training. The collection I/O adapter uses standard-library Python 3.9+; it explicitly decodes Windows-1251. Cached 404s are not requested again unless refreshed. Complete responses are checked against HTTP Content-Length, written atomically and hashed, allowing safe resumption.

## Extending our collection

Domain types are in `src/lib/kruczie/corpus/types.ts`. A `ChantWork` is the work; independent `ChantWitness` records hold its source, chant tradition, tone evidence and notation kind. Code aliases connect reused chants without merging their musical realizations. `ChantNotationKind` already distinguishes double notation, pitched neumes, unpitched neumes and notes. Only double-notation samples currently train the model. Different traditions and unknown/conflicting tones are not silently combined with a requested tone.

New local or imported collections should supply their own namespace/work IDs and source provenance, preserving independent witness texts and syllable boundaries. A two-neume group attached to one syllable remains indivisible unless a source explicitly establishes a finer partition.

## npm boundary

`corpus:build` writes compact learned weights to the sibling `../kruczie-npm/src/ngrams/model.json`. That model stores N=1/2/3 mappings, empirical counts by tone/source and a small number of reference links. It contains **no complete chants or syllables**. The portal's client receives only the optional npm model and a tiny `src/data/kruczie-corpus-metadata.json`; archive and training collection are not browser assets.

Source catalog: <http://znamen.ru/src.php>. Source terms: <http://znamen.ru/org.php#usl>. A standard dataset license is not declared; retain the original attribution and terms. Raw sources are retained locally and are not published by the collection scripts.

## Recovery audit (v2)

The current derived model/collection is `znamen-2026-10-29-v3`; the archive directory still names the original v1 byte snapshot, which is unchanged. `corpus:build` now keeps verified contiguous musical segments. Neume/note group counts must agree; differing text counts produce music-only observations with no invented syllables. Invalid positions split samples. `quality-report.json` distinguishes fully excluded blocks from recovered blocks; `rejected` lists all problematic blocks, including partially recovered ones. `corpus:audit` writes per-group raw evidence for both w20g1 fixtures to `neume-audit.json`; raw occurrence totals are not deduplicated training counts.

Opaque neume spellings now train exact musical mappings when musical positions align and note durations are readable. `opaque: true` marks these positions in the collection; recognition is not a prerequisite for an observed pairing. Empty slots and placeholders split training segments. `quality-report.json` and runtime metadata report `opaquePositions`. Shape-based unpitched suggestions are runtime proposals from explicitly pitched spellings; they never create synthetic training observations or exact N-gram counts.
