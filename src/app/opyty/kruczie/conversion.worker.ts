import { builtinCorpusIndex } from "@/lib/kruczie/corpus/builtin";
import { runConversion } from "@/lib/kruczie/playground";
import type { ConversionRequest } from "@/lib/kruczie/model";

self.onmessage = async (event: MessageEvent<{ id: number; request: ConversionRequest }>) => {
    const { id, request } = event.data;
    try {
        self.postMessage({ id, phase: "initializing" });
        await builtinCorpusIndex();
        self.postMessage({ id, phase: "searching" });
        self.postMessage({ id, value: await runConversion(request) });
    } catch (error) {
        self.postMessage({ id, error: error instanceof Error ? error.message : "Не удалось выполнить перевод." });
    }
};
