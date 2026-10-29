import type { CorpusFallback, CorpusRanking, CorpusReference } from "@/lib/kruczie/corpus";
function toneLabel(example: CorpusReference) {
    return example.tone ? `глас ${example.tone}` : example.toneEvidence ? "глас источника не определён" : "глас не указан в модели";
}
export function FallbackNotice({ fallback }: { fallback: CorpusFallback }) {
    const examples = fallback.ranking.evidence.flatMap(e => e.examples).slice(0, 4);
    return <div className="text-xs text-amber-900 border-l-2 border-amber-500 pl-2 my-2">
        <p>{fallback.kind === "unpitched" ? `Поиск беспометного крюка через помеченный вариант ${fallback.sourceNeumes}${fallback.outsideTone ? ` · вне гласа ${fallback.requestedTone}` : ""}` : `Запасной поиск · вне выбранного гласа ${fallback.requestedTone}`}: <code>{fallback.neumes}</code> → <code>{fallback.notes}</code>.</p>
        <p>{fallback.kind === "unpitched" ? "Предложение по совпадающему начертанию без высотных помет; исходная крюковая запись сохранена. Это не точное совпадение N-граммы." : "Принадлежность к выбранному гласу не подтверждена."} Высота взята из источника, без автоматической транспозиции.</p>
        {examples.map((example, i) => <a className="underline block" href={example.url} target="_blank" rel="noreferrer" key={i}>
            {example.sourceId} · {toneLabel(example)} · {example.workId.replace(/^znamen:/u, "")} · блок {example.block + 1}, позиция {example.position + 1}
            {example.recovery ? ` · восстановлен ${example.recovery === "music-only" ? "по совпадающим музыкальным слоям без привязки текста" : "из проверенного участка исключённого блока"}` : ""}
        </a>)}
        <p>Поддержка исходного варианта{fallback.kind === "unpitched" && !fallback.outsideTone ? " в выбранном контексте" : " без фильтра гласа"}: {fallback.ranking.evidence.map(e => `${e.count}/${e.total}`).join(", ")} вхождений. Эта оценка не прибавляется к поддержке выбранного гласа.</p>
    </div>;
}
export default function CorpusPreference({ ranking, hypothesis = false }: { ranking?: CorpusRanking; hypothesis?: boolean }) {
    if (!ranking?.score && !ranking?.fallbacks?.length && !ranking?.preference) return <p className="text-xs text-slate-500">Корпус не даёт основания для предпочтения в выбранном гласе и источнике.</p>;
    return <div className="max-w-xl">
        {ranking!.preference && <div className="text-xs border-l-2 border-green-700 pl-2 my-2">
            <p>{ranking!.preference.scope === "work" ? "Совместный выбор для всего произведения, включая границы строк." : "Приоритет троек перед парами и одиночными соответствиями."}</p>
            {ranking!.preference.reference && <><a className="underline" href={ranking!.preference.reference.url} target="_blank" rel="noreferrer">Параллельный двоезнаменник: {ranking!.preference.reference.sourceId} · {ranking!.preference.reference.workId.replace(/^znamen:/u,"")} · глас {ranking!.preference.reference.tone ?? "не указан"}</a>
                <p>Нотных совпадений в сопоставленных позициях: {ranking!.preference.reference.matched} из {ranking!.preference.reference.aligned}. Сопоставление учитывает текст и крюки; редакции песнопения могут различаться.</p>
                <details><summary>Сравнение позиций этого блока с источником</summary>{ranking!.preference.reference.positions.map((p,i)=><p key={i}>Позиция {p.position+1}: <code>{p.notes}</code> · источник, блок {p.sourceBlock+1}, позиция {p.sourcePosition+1} · {p.exact?"выбрано точное нотное совпадение":"ориентир; этот развод не подставлен автоматически"}</p>)}</details>
            </>}
            <p>Поддержанных троек: {ranking!.preference.orders.triples}, пар: {ranking!.preference.orders.pairs}. Сначала учитываются непрерывные совпадения параллельного источника, затем тройки и пары. Плавность влияет на неподтверждённые стыки; записанные в источниках скачки сохраняются. Оценка неподтверждённых стыков: {ranking!.preference.unsupportedJoinCost.toFixed(1)}.</p>
        </div>}

        {ranking!.parallels?.map((p,i)=><div className="text-xs text-green-900 border-l-2 border-green-600 pl-2 my-2" key={i}><p>Позиция {p.position+1}: <code>{p.notes}</code> · {p.match==="exact"?"точное крюковое соответствие в параллельном источнике":"беспометный вариант сопоставлен по тексту и основному знаку"}.</p><a className="underline" href={p.url} target="_blank" rel="noreferrer">{p.sourceId} · блок {p.sourceBlock+1}, позиция {p.sourcePosition+1}: <code>{p.sourceNeumes}</code> → <code>{p.notes}</code></a><p>Исходная запись сохранена. Это отдельное основание из параллельного двоезнаменника; частоты N-грамм не изменены.</p></div>)}
        {ranking!.fallbacks?.map((fallback, i) => <FallbackNotice key={i} fallback={fallback} />)}
        {!!ranking!.score && <details className="text-xs text-slate-600">
            <summary className="cursor-pointer">Основания корпуса · оценка {ranking!.score.toFixed(2)} · позиций {ranking!.supportedPositions}</summary>
            {hypothesis && <p>Оценка одного из вариантов строки; показаны основания для этой позиции. Соседние разводы ещё могут быть не выбраны.</p>}
            <p>Числовая оценка — суммарная поддержка корпуса; порядок выбора задают перечисленные основания, а не одна сумма. Это не вероятность правильности. Повторные копии одной записи не увеличивают частоту. Корпус {ranking!.corpusVersion}.</p>
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
