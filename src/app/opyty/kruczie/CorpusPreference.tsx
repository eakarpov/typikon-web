import type { CorpusRanking } from "@/lib/kruczie/corpus";
export default function CorpusPreference({ ranking, hypothesis = false }: { ranking?: CorpusRanking; hypothesis?: boolean }) {
    if (!ranking?.score) return <p className="text-xs text-slate-500">Корпус не даёт основания для предпочтения в выбранном гласе и источнике.</p>;
    return <details className="text-xs text-slate-600 max-w-xl">
        <summary className="cursor-pointer">Основания корпуса · оценка {ranking.score.toFixed(2)} · позиций {ranking.supportedPositions}</summary>
        {hypothesis && <p>Оценка одного из вариантов строки; показаны основания для этой позиции. Соседние разводы ещё могут быть не выбраны.</p>}
        <p>Оценка поддержки в корпусе, не вероятность правильности. Повторные копии одной записи не увеличивают частоту. Корпус {ranking.corpusVersion}.</p>
        <ul className="list-disc pl-4">{ranking.evidence.slice(0,8).map((e,i) => <li key={i} className="mt-2">
            {e.order === 3 ? "Тройка" : e.order === 2 ? "Пара" : "Один крюк"}: <code>{e.neumes.join(" · ")}</code> → <code>{e.notes.join(" · ")}</code>.
            Этот развод: {e.count} из {e.total} вхождений; песнопений {e.chantCount}; источники {e.sourceIds.join(", ")}.
            {e.examples.map((example,j) => <a className="underline block" href={example.url} target="_blank" rel="noreferrer" key={j}>{example.sourceId} · {example.workId.replace(/^znamen:/u, "")} · блок {example.block+1}, позиция {example.position+1}</a>)}
        </li>)}</ul>
    </details>;
}
