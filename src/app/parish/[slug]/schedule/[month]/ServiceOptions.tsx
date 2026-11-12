'use client';
import type { ServiceDetails, ServiceMemory } from '@/lib/parish/serviceDetails';
import ServiceMemories from './ServiceMemories';
export default function ServiceOptions({ services, value, onChange, choices }: {
    services: string[];
    value: ServiceDetails;
    onChange: (value: ServiceDetails) => void;
    choices?: ServiceMemory[];
}) {
    return <>
 {services.includes('moleben') && <div><ServiceMemories title="Кому служится молебен" value={value.moleben?.memories ?? []} max={4} choices={choices} onChange={memories => onChange({ ...value, moleben: { memories, akathist: value.moleben?.akathist ?? false } })}/><label className="flex gap-2"><input type="checkbox" checked={value.moleben?.akathist ?? false} onChange={e => onChange({ ...value, moleben: { memories: value.moleben?.memories ?? [], akathist: e.target.checked } })}/>Молебен с акафистом</label></div>}
 {services.some(k => k === 'compline' || k === 'compline-great') && <ServiceMemories title="Дополнительные памяти на повечерии" value={value.compline?.memories ?? []} max={2} choices={choices} onChange={memories => onChange({ ...value, compline: { memories } })}/>}
 </>;
}
