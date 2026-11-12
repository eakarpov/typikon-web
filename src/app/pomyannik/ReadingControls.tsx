'use client';
import type { PomyannikPerson } from "@/lib/pomyannik/types";
import type { ReadingPlace } from "@/lib/pomyannik/reader";
const FIELD = "border rounded px-2 py-2 bg-white max-w-full";
export default function ReadingControls({ persons, group, kind, onChange, disabled = false }: {
    persons: PomyannikPerson[]; group: string; kind: ReadingPlace["kind"];
    onChange: (group: string, kind: ReadingPlace["kind"]) => void; disabled?: boolean;
}) {
    const groups = Array.from(new Set([...persons.flatMap(person => person.groups), ...(group ? [group] : [])])).sort((a, b) => a.localeCompare(b, "ru"));
    return <fieldset disabled={disabled} className="flex flex-wrap gap-3 min-w-0">
        <label className="flex flex-col gap-1">Раздел
            <select className={FIELD} value={kind} onChange={e => onChange(group, e.target.value as ReadingPlace["kind"])}>
                <option value="all">О здравии и о упокоении</option><option value="living">О здравии</option><option value="departed">О упокоении</option>
            </select>
        </label>
        <label className="flex flex-col gap-1 max-w-full">Группа
            <select className={FIELD} value={group} onChange={e => onChange(e.target.value, kind)}>
                <option value="">Все группы</option>{groups.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
        </label>
    </fieldset>;
}
