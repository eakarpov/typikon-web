import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ChantCollection } from "../lib/kruczie/corpus/types";
import type { ParallelIndex } from "../lib/kruczie/parallelTypes";
async function main() {
    const root = resolve(process.cwd(),"data/chant-corpus/znamen-v1");
    const corpus = JSON.parse(await readFile(resolve(root,"collection.json"),"utf8")) as ChantCollection;
    const index: ParallelIndex = {version:corpus.version,works:corpus.works.map(({id,canonicalCode,aliases})=>({id,canonicalCode,aliases})),witnesses:corpus.witnesses.map(({attribution,rightsUrl,...w})=>{void attribution;void rightsUrl;return w;})};
    await writeFile(resolve(root,"parallel-index.json"),JSON.stringify(index)+"\n");
    console.log(JSON.stringify({works:index.works.length,witnesses:index.witnesses.length}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
