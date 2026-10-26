import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildReferenceProfiles } from "../lib/kruczie/referenceStats";

async function main() {
    const { createBuiltinCatalog } = await import("@znamenica/kruczie/data");
    const catalog = createBuiltinCatalog();
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const result = { dependency: pkg.dependencies["@znamenica/kruczie"], datasetVersion: catalog.dataset.manifest.version,
        method: "most-frequent-ending-of-distinct-measured-formulas", profiles: await buildReferenceProfiles(catalog) };
    writeFileSync(join(process.cwd(), "src/data/kruczie-tone-references.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(`Собраны наблюдения для ${result.profiles.length} гласов/распевов; база ${result.datasetVersion}.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
