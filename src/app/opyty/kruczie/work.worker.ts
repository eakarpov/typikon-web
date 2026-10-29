import { builtinCorpusIndex } from "@/lib/kruczie/corpus/builtin";
import { rankWholeWork } from "@/lib/kruczie/workRanking";
import type { ParallelWork } from "@/lib/kruczie/parallelTypes";
import { inspectWork, translateWorkBlock, type WorkOptions } from "@/lib/kruczie/work";

self.onmessage = async (event: MessageEvent<{ raw: string; options: WorkOptions }>) => {
    try {
        self.postMessage({phase:"initializing"});
        const view = await inspectWork(event.data.raw);
        await builtinCorpusIndex();
        let parallel: ParallelWork | undefined, referenceError = false;
        const code = view.file.lines.find(line=>line.name === "код")?.payload?.trim().split(/\s+/u)[0];
        if(code && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/u.test(code)) {
            try {const response=await fetch(`/api/kruczie/references/${encodeURIComponent(code)}`,{signal:AbortSignal.timeout(60000)});if(response.ok)parallel=await response.json();else referenceError=true;} catch {referenceError=true;}
        }
        const results: Record<number, import("@/lib/kruczie/work").WorkResult> = {};
        for (let index = 0; index < view.blocks.length; index++) {
            try {
                const result = await translateWorkBlock(view, index, event.data.options);
                results[index] = result;
                self.postMessage({ result, completed: index + 1, total: view.blocks.length });
            } catch (error) {
                self.postMessage({ result: { blockIndex: index, candidates: [], status: "untranslated", truncated: false,
                    diagnostics: [{ code: "WORK_BLOCK_ERROR", severity: "error", message: error instanceof Error ? error.message : "Ошибка обработки блока" }] }, completed: index + 1, total: view.blocks.length });
            }
        }
        self.postMessage({phase:"ranking"});
        const ranked = await rankWholeWork(view,results,event.data.options,parallel);
        for(const result of Object.values(ranked)) self.postMessage({result:{...result,diagnostics:[...result.diagnostics,...(referenceError?[{code:"PARALLEL_SOURCE_UNAVAILABLE",severity:"warning",message:"Параллельный двоезнаменник не удалось загрузить; использованы N-граммы и оценка стыков."}]:[])]},completed:view.blocks.length});
        self.postMessage({ done: true });
    } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : "Не удалось обработать произведение." });
    }
};
