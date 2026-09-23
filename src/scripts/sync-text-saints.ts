// Разовый перенос и сверка: ключи каталога у текстов по их номерам святцев
// (@/lib/textSaints). Повторяем: пишет только то, что разошлось. Гонять после
// build-saints.ts и import-memory-saints.ts — каталог мог прирасти.
//
// Запуск:  npm run texts:saints  [-- --write]
import "@/scripts/lib/env";
import { syncTextSaints } from "@/lib/textSaints";

const main = async () => {
    const write = process.argv.includes("--write");
    const r = await syncTextSaints({}, write);
    console.log(`текстов со святыми: ${r.seen}; расходится с каталогом: ${r.updated}`);
    if (r.unmapped.size) {
        console.log(`номеров святцев, которых нет в каталоге: ${r.unmapped.size} — ${[...r.unmapped].slice(0, 20).join(", ")}`);
    }
    console.log(write ? "записано" : "холостой прогон — ничего не записано; --write запишет");
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
