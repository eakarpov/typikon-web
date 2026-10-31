import data from "@/data/kruczie-corpus-metadata.json";
export default function CorpusControls({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
    const unknown = (data as typeof data & {toneUnknownCount?:number}).toneUnknownCount ?? 0;
    const sources: readonly { id: string; title: string }[] = data.sources;
    return <div className="min-w-0 border border-slate-200 rounded p-3 text-sm flex flex-col gap-2">
        <label>Источник корпуса <select className="block w-full min-w-0 max-w-full border border-slate-300 rounded p-1 bg-white text-slate-900" disabled={disabled} value={value} onChange={e=>onChange(e.target.value)}>
            <option value="">Все источники</option>{sources.map(source=><option key={source.id} value={source.id}>{source.title}</option>)}
        </select></label>
        <p>Корпус двоезнаменников {data.version}: записей {data.witnessCount}, песнопений {data.workCount}. Частоты учитывают выбранный глас и источник. Сохранённые пользователем ноты не меняются при ранжировании.</p>
        {unknown > 0 && <p className="text-xs text-slate-500">Без однозначного гласа: {unknown} записей. Они не участвуют в основном рейтинге выбранного гласа; могут использоваться только как явно помеченный запасной вариант.</p>}
        {data.opaquePositions > 0 && <p className="text-xs text-slate-500">Соответствий с неразобранным начертанием: {data.opaquePositions}. Ноты подтверждены совпадающими музыкальными позициями источника.</p>}
        {data.recoveredPositions > 0 && <p className="text-xs text-slate-500">Восстановлено проверенных позиций: {data.recoveredPositions} из {data.recoveredBlocks} проблемных блоков. Через повреждённые позиции пары и тройки не строятся.</p>}
        <p className="text-xs text-slate-500">Полностью исключено блоков: {data.rejectedBlocks}. Ранжируются только найденные варианты; ограниченный поиск не гарантирует лучший из всех возможных разводов.</p>
    </div>;
}
