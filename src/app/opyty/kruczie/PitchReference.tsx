'use client';
import type { ChantTradition, Tone } from "@znamenica/kruczie";
import { pitchLabel, referenceProfile, suggestedReference, writtenReference, referenceShift, REFERENCE_DATASET_VERSION, type PitchReferenceSettings } from "@/lib/kruczie/reference";

const field = "border border-slate-300 rounded px-2 py-1 bg-white text-slate-900 disabled:opacity-50";
export default function PitchReference({ tradition, tone, value, onChange }: {
    tradition: ChantTradition; tone?: Tone; value: PitchReferenceSettings; onChange: (value: PitchReferenceSettings) => void;
}) {
    const profile = referenceProfile(tradition, tone), suggestion = suggestedReference(profile);
    const written = writtenReference(value, tradition, tone), shift = referenceShift(value, tradition, tone);
    return <fieldset className="border border-slate-200 rounded p-3 flex flex-col gap-2">
        <legend className="text-sm px-1">Опорная ступень гласа и высота звучания</legend>
        <label><input type="checkbox" checked={value.enabled && written !== null} disabled={written === null} onChange={e => onChange({ ...value, enabled: e.target.checked })} /> Настроить высоту опорной ступени</label>
        <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">Ступень в записи коллекции
                <select className={field} value={value.writtenMidi === undefined ? "auto" : value.writtenMidi} onChange={e => onChange({ ...value, writtenMidi: e.target.value === "auto" ? undefined : Number(e.target.value) })}>
                    <option value="auto">{suggestion !== null ? `По коллекции: ${pitchLabel(suggestion)}` : "Нет однозначного предложения — выберите вручную"}</option>
                    {Array.from({ length: 25 }, (_, i) => i + 60).map(midi => <option value={midi} key={midi}>{pitchLabel(midi)}</option>)}
                </select>
            </label>
            <label className="flex flex-col gap-1">Желаемая высота звучания ступени
                <select className={field} disabled={!value.enabled || written === null} value={value.soundingMidi} onChange={e => onChange({ ...value, soundingMidi: Number(e.target.value) })}>
                    {Array.from({ length: 48 }, (_, i) => i + 36).map(midi => <option value={midi} key={midi}>{pitchLabel(midi)}</option>)}
                </select>
            </label>
        </div>
        {profile && suggestion !== null && <p className="text-xs text-slate-600">Предложение из базы {REFERENCE_DATASET_VERSION}: {pitchLabel(suggestion)} завершает {profile.endings[0].count} из {profile.formulaCount} различных мелодий формул гласа {tone}. Повторные копии одной мелодии не увеличивают счёт. Это наблюдение коллекции, опорную ступень можно изменить.</p>}
        {!profile && <p className="text-xs text-slate-600">{tone === undefined ? "Выберите глас для предложения по коллекции либо задайте ступень вручную." : "В коллекции нет формул этого распева и гласа. Задайте ступень вручную."}</p>}
        <p className="text-xs text-slate-600">{value.enabled && written !== null ? `${pitchLabel(written)} звучит как ${pitchLabel(value.soundingMidi)}; весь напев сдвинут на ${shift > 0 ? "+" : ""}${shift} полутонов.` : "Используется исходная высота звучания."} Интервалы и ритм сохраняются. Выбранная высота применяется к звуку, нотам на стане и экспорту. Крюковые пометы переносятся только по подтверждённым соответствиям коллекции; при невозможности согласованного переноса экспорт блокируется.</p>
    </fieldset>;
}
