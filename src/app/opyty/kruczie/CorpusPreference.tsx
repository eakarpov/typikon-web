import type { CorpusFallback, CorpusRanking, CorpusReference } from "@/lib/kruczie/corpus";
function toneLabel(example: CorpusReference) {
    return example.tone ? `глас ${example.tone}` : example.toneEvidence ? "глас источника не определён" : "глас не указан в модели";
}
export function FallbackNotice({ fallback }: { fallback: CorpusFallback }) {
    const examples = fallback.ranking.evidence.flatMap(e => e.examples).slice(0, 4);
    return <div className="text-xs text-amber-900 border-l-2 border-amber-500 pl-2 my-2">
        <p>Запасной поиск · вне выбранного гласа {fallback.requestedTone}: <code>{fallback.neumes}</code> → <code>{fallback.notes}</code>.</p>
        <p>Источник соответствия; принадлежность к выбранному гласу не подтверждена. Высота взята из источника, без автоматической транспозиции.</p>
        {examples.map((example, i) => <a className="underline block" href={example.url} target="_blank" rel="noreferrer" key={i}>
            {example.sourceId} · {toneLabel(example)} · {example.workId.replace(/^znamen:/u, "")} · блок {example.block + 1}, позиция {example.position + 1}
            {example.recovery ? ` · восстановлен ${example.recovery === "music-only" ? "по совпадающим музыкальным слоям без привязки текста" : "из проверенного участка исключённого блока"}` : ""}
        </a>)}
        <p>Поддержка без фильтра гласа: {fallback.ranking.evidence.map(e => `${e.count}/${e.total}`).join(", ")} вхождений. Эта оценка не прибавляется к поддержке выбранного гласа.</p>
    </div>;
}
export default function CorpusPreference({ ranking, hypothesis = false }: { ranking?: CorpusRanking; hypothesis?: boolean }) {
    if (!ranking?.score && !ranking?.fallbacks?.length) return <p className="text-xs text-slate-500">Корпус не даёт основания для предпочтения в выбранном гласе и источнике.</p>;
    return <div className="max-w-xl">
        {ranking!.fallbacks?.map((fallback, i) => <FallbackNotice key={i} fallback={fallback} />)}
        {!!ranking!.score && <details className="text-xs text-slate-600">
            <summary className="cursor-pointer">Основания корпуса · оценка {ranking!.score.toFixed(2)} · позиций {ranking!.supportedPositions}</summary>
            {hypothesis && <p>Оценка одного из вариантов строки; показаны основания для этой позиции. Соседние разводы ещё могут быть не выбраны.</p>}
            <p>Оценка поддержки в корпусе, не вероятность правильности. Повторные копии одной записи не увеличивают частоту. Корпус {ranking!.corpusVersion}.</p>
            <ul className="list-disc pl-4">{ranking!.evidence.slice(0, 8).map((e, i) => <li key={i} className="mt-2">
                {e.order === 3 ? "Тройка" : e.order === 2 ? "Пара" : "Один крюк"}: <code>{e.neumes.join(" · ")}</code> → <code>{e.notes.join(" · ")}</code>.
                Этот развод: {e.count} из {e.total} вхождений; песнопений {e.chantCount}; источники {e.sourceIds.join(", ")}.
                {e.examples.map((example, j) => <a className="underline block" href={example.url} target="_blank" rel="noreferrer" key={j}>
                    {example.sourceId} · {toneLabel(example)} · {example.workId.replace(/^znamen:/u, "")} · блок {example.block + 1}, позиция {example.position + 1}
                    {example.recovery ? ` · восстановлен ${example.recovery === "music-only" ? "по музыкальным слоям; текст не привязан" : "из проверенного участка исключённого блока"}` : ""}
                </a>)}
            </li>)}</ul>
        </details>}
    </div>;
}
