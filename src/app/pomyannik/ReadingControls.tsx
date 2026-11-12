'use client';
import type { PomyannikGroup } from "@/lib/pomyannik/groups";
import type { PomyannikPerson } from "@/lib/pomyannik/types";
import type { ReadingPlace } from "@/lib/pomyannik/reader";
const FIELD = "border rounded px-2 py-2 bg-white max-w-full";
export default function ReadingControls({ availableGroups, group, kind, onChange, disabled = false }: {
    persons: PomyannikPerson[]; availableGroups:PomyannikGroup[]; group: string; kind: ReadingPlace["kind"];
    onChange: (group: string, kind: ReadingPlace["kind"]) => void; disabled?: boolean;
}) {
    const groups=availableGroups.slice().sort((a,b)=>a.name.localeCompare(b.name,"ru"));
    return <fieldset disabled={disabled} className="flex flex-wrap gap-3 min-w-0">
        <label className="flex flex-col gap-1">Раздел
            <select className={FIELD} value={kind} onChange={e => onChange(group, e.target.value as ReadingPlace["kind"])}>
                <option value="all">О здравии и о упокоении</option><option value="living">О здравии</option><option value="departed">О упокоении</option>
            </select>
        </label>
        <label className="flex flex-col gap-1 max-w-full">Группа
            <select className={FIELD} value={group} onChange={e => onChange(e.target.value, kind)}>
                <option value="">Все группы</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
        </label>
    </fieldset>;
}
