import { inspectWork, translateWorkBlock, type WorkOptions } from "@/lib/kruczie/work";

self.onmessage = async (event: MessageEvent<{ raw: string; options: WorkOptions }>) => {
    try {
        const view = await inspectWork(event.data.raw);
        for (let index = 0; index < view.blocks.length; index++) {
            try {
                const result = await translateWorkBlock(view, index, event.data.options);
                self.postMessage({ result, completed: index + 1, total: view.blocks.length });
            } catch (error) {
                self.postMessage({ result: { blockIndex: index, candidates: [], status: "untranslated", truncated: false,
                    diagnostics: [{ code: "WORK_BLOCK_ERROR", severity: "error", message: error instanceof Error ? error.message : "Ошибка обработки блока" }] }, completed: index + 1, total: view.blocks.length });
            }
        }
        self.postMessage({ done: true });
    } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : "Не удалось обработать произведение." });
    }
};
