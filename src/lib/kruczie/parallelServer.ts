import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import type { ParallelWork, ParallelWitness, ParallelIndex } from "./parallelTypes";
const indices = new Map<string, Promise<ParallelIndex>>();
/** Read-only public corpus adapter. User text and notes never enter this endpoint. */
export async function loadParallelWork(code: string, root = resolve(process.cwd(), "data/chant-corpus/znamen-v1")): Promise<ParallelWork> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/u.test(code)) throw new Error("Invalid public work code");
    let pending = indices.get(root);
    if (!pending) { pending = readFile(resolve(root,"parallel-index.json"),"utf8").then(text => JSON.parse(text) as ParallelIndex); indices.set(root,pending); }
    const index = await pending, work = index.works.find(work => work.canonicalCode === code || work.aliases?.includes(code));
    if (!work) return { version: index.version, code, witnesses: [] };
    const [{ parseZnamen, tokenizeUnderlay }, { getMeasuredNotes }] = await Promise.all([import("@znamenica/kruczie/formats/znamen"),import("@znamenica/kruczie/melody")]);
    const records = index.witnesses.filter(w => w.workId === work.id).sort((a,b) => a.sourceId.localeCompare(b.sourceId,"en") || a.id.localeCompare(b.id,"en"));
    const witnesses: ParallelWitness[] = [];
    for (const record of records.slice(0,16)) {
        const path = resolve(root,record.rawPath);
        if (!path.startsWith(resolve(root)+sep)) throw new Error("Unsafe corpus path");
        const raw = await readFile(path,"utf8");
        if (createHash("sha256").update(raw).digest("hex") !== record.sha256) throw new Error("Corpus checksum mismatch");
        const file = parseZnamen(raw).value;
        if (!file) continue;
        const beginning = file.lines.find(line => line.name === "начало")?.range.end ?? 0;
        const groups: ParallelWitness["groups"][number][] = [];
        let ordinal = 0, segment = 0;
        for (const [blockIndex,block] of file.blocks.entries()) {
            if (block.range.start < beginning) continue;
            const neumes = block.notation?.trim().split(/\s+/u).filter(Boolean) ?? [], notes = block.melody?.trim().split(/\s+/u).filter(Boolean) ?? [];
            const text = block.text === undefined ? [] : tokenizeUnderlay(block.text);
            if (!neumes.length || neumes.length !== notes.length) { segment++; continue; }
            for (let position = 0;position<neumes.length;position++,ordinal++) {
                const music = getMeasuredNotes(notes[position]);
                if (!music.value?.length || music.diagnostics.some(d => d.severity === "error") || neumes[position] === "_") { segment++; continue; }
                groups.push({neumes:neumes[position],notes:notes[position],text:text.length===neumes.length ? text[position].raw : "",block:blockIndex,position,ordinal,segment});
                if (/[\\/]/u.test(notes[position])) segment++;
            }
        }
        if (groups.length) witnesses.push({id:record.id,workId:record.workId,sourceId:record.sourceId,url:record.url,sha256:record.sha256,tradition:record.tradition,...(record.tone ? {tone:record.tone}:{}),groups});
    }
    return {version:index.version,code,witnesses,...(records.length>16 ? {truncated:true}:{})};
}
