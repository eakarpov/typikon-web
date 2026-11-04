/** Explicit editorial queue: import candidates; publication requires a reviewer and source validation. */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import fs from "node:fs/promises";
import { validateTarget, locate } from "@/lib/study/core";
let opened = false;
async function main() {
  const file = process.argv[2],
    checked = process.argv.includes("--checked"),
    reviewer = process.env.STUDY_REVIEWER;
  if (!file || (checked && !reviewer))
    throw Error(
      "Usage: tsx src/scripts/study-relations-import.ts file.json [--checked]; STUDY_REVIEWER обязателен для публикации.",
    );
  const rows = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(rows) || rows.length > 1000)
    throw Error("Ожидается массив до 1000 связей.");
  const { corpus, material } = await import("@/lib/study/material");
  const db = await corpus();
  opened = true;
  const ready = [];
  for (const r of rows) {
    if (
      !/^[-\w]{1,100}$/.test(r.id) ||
      !["scripture", "commentary", "citation", "topic", "alignment"].includes(
        r.kind,
      ) ||
      !r.author ||
      !r.reason ||
      !r.locator ||
      !r.sourceUrl
    )
      throw Error(
        "Запись требует ID, вид связи, автора, основание, точное место и URL источника.",
      );
    const from = validateTarget(r.from),
      to = validateTarget(r.to);
    if (checked)
      for (const t of [from, to]) {
        const m = await material(t);
        if (
          !t.edition ||
          (!t.blockId && !t.verseFrom) ||
          (t.quote && !locate(m, t))
        )
          throw Error("Не подтверждён точный адрес: " + r.id);
      }
    ready.push({
      ...r,
      from,
      to,
      status: checked ? "checked" : "candidate",
      reviewer: checked ? reviewer : null,
      checkedAt: checked ? new Date().toISOString() : null,
      version: Number(r.version) || 1,
    });
  }
  await db
    .collection("studyRelations")
    .createIndex({ id: 1 }, { unique: true });
  await db
    .collection("studyRelations")
    .createIndex({ status: 1, "from.kind": 1, "from.id": 1 });
  await db
    .collection("studyRelations")
    .createIndex({ status: 1, "to.kind": 1, "to.id": 1 });
  for (const r of ready)
    await db
      .collection("studyRelations")
      .replaceOne({ id: r.id }, r, { upsert: true });
  console.log(
    `${checked ? "Проверенных" : "Кандидатных"} связей: ${ready.length}.`,
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!opened) return;
    const { default: client } = await import("@/lib/mongodb");
    await (await client).close();
  });
