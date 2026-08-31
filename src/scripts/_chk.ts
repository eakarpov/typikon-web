import "@/scripts/lib/env";
import fs from "fs";
import { mappingsFor, toCanonRef } from "@/lib/bible/mappings";
import { REFERENCE_VERSIFICATION } from "@/utils/bibleVersification";
const src = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
const rules = mappingsFor(src.code);
let coll = 0, out = 0, mapped = 0, total = 0;
for (const bk of src.books as any[]) {
  if (!REFERENCE_VERSIFICATION[bk.canonId]) continue;
  const seen = new Map<string, string>();
  for (const [c, vs] of Object.entries(bk.chapters) as [string, any][])
    for (const v of Object.keys(vs)) {
      total++;
      const r = toCanonRef(rules, bk.slug, Number(c), Number(v));
      const k = `${r.canonId}.${r.chapter}:${r.verse}`;
      if (r.chapter !== Number(c) || r.verse !== Number(v) || r.canonId !== bk.slug) mapped++;
      if (seen.has(k)) { coll++; if (coll <= 5) console.log(`  СТОЛКНОВЕНИЕ ${k}: ${bk.slug} ${c}:${v} и ${seen.get(k)}`); }
      else seen.set(k, `${c}:${v}`);
      const len = REFERENCE_VERSIFICATION[r.canonId]?.[r.chapter - 1] ?? 0;
      if (r.verse < 1 || r.verse > len) out++;
    }
}
console.log(`${src.code}: стихов ${total}, перенумеровано ${mapped}, СТОЛКНОВЕНИЙ ${coll}, вне эталона ${out}`);
process.exit(0);
