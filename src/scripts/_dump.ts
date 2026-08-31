import "@/scripts/lib/env";
import fs from "fs";
import clientPromise from "@/lib/mongodb";
import { BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";
const main = async () => {
  const db = (await clientPromise).db("typikon");
  const out: any = {};
  for (const code of ["cs-eliz", process.argv[2]]) {
    const ed = await db.collection(BIBLE_EDITIONS).findOne({ code });
    const rows = await db.collection(BIBLE_VERSES)
      .find({ editionId: ed!._id }, { projection: { canonId: 1, chapter: 1, verse: 1, content: 1 } }).toArray();
    const key = code === "cs-eliz" ? "cs-eliz" : "other";
    out[key] = {};
    rows.forEach((r: any) => {
      (out[key][r.canonId] ??= {}); (out[key][r.canonId][r.chapter] ??= {});
      out[key][r.canonId][r.chapter][r.verse] = r.content;
    });
  }
  fs.writeFileSync("/tmp/all.json", JSON.stringify(out));
  console.log("выгружено");
  process.exit(0);
};
main().catch(e => { console.error(e); process.exit(1); });
