# Corpus pilot publication: Unicode17

The publication runtime is Node v22.23.2 / ICU78.2 / Unicode17, pinned in `.nvmrc`.
The adjacent cs-app provides `tool/corpus/node17.sh` and a verified official
runtime manifest. Unicode16 baselines use a separate historical Node16-Unicode
runtime; do not change old r1 definitions to the current runtime.

`cs-pilot-{source,unicode,letterfold}-r2` are distinct from frozen Unicode16 r1
profiles. Tokenizer algorithm/token IDs are preserved where full pilot comparison
proves identical raw ranges, token types, keys, flags and map segments. The
letterfold profile remains excluded from the corpus index for its pre-existing
PUA identity differences; Unicode17 does not claim to fix them.

Scripts:

- `reader-unicode-baseline.ts`: read-only Unicode16 hashes of all token records,
  map segments and display text, after checking old raw hashes in current native data.
- `reader-unicode-migrate.ts`: isolate reader sidecars in `typikon_reader_m202_u17`,
  compare 201 projections, verify native bridges, preserve source/body/occurrence/
  fragment IDs and all four review records, then build/export the new index/registry.
- `reader-unicode-import.ts`: server preflight against exact native dataset and D;
  without flags writes only the isolated sidecar registry; `--prepare` inserts
  conflict-checked immutable production records without activation; `--activate`
  separately swaps the allowlisted pilot state after validation. Use `--backup`
  once to preserve the prior pilot state before activation.

`CS_READER_REGISTRY_DB` may only name `typikon_reader_*`. It routes reader*
collections to an acceptance namespace while canonical texts/books remain in
`typikon`. Production uses the default namespace. No canonical text is copied.

`readerBodyRebindings` permits old raw revisions to resolve through an explicitly
audited native artifact bridge only; raw SHA256 is still checked at every read.
No bridge or different bytes retains 410. Profiles do not permit old offsets to
be applied to new raw bytes. Previous source revisions and address IDs remain.

Pilot state sets `legacyRegistryActive:false`: publishing a five-source corpus
must not activate the portal-wide legacy numeric-ID migration. Existing globally
prepared registries without this flag retain their former behavior.

Public access is scoped to reader/index with existing native visibility checks,
120 requests/min/IP aggregate, 30/min search+occurrences, 30/min lookup. OPTIONS is
unmetered at the application layer. Source rights remain unresolved where unknown.
Old search shapes and dictionary schema1/schema2 remain; no APK or app/version
endpoints change. Pilot navigation is under `/opyty/cs-reader`, without homepage.

Publication receipts, tests, frozen source hashes and roadmap live in adjacent
cs-app `qa/mobile/m2-02-u17/` and `docs/m2-02-unicode17-publication.md`.
