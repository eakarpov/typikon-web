import type { ParishDay } from '@/lib/parish/types';
import { SIGN_GLYPHS } from '@/utils/signs';
import { SIGN } from '@/types/dto/days';
const SIGNS: Record<string, string> = { 'shesterichnaya': SIGN.SIX_STICHERA, 'slavoslovie': SIGN.DOXOLOGIC, 'polieley': SIGN.POLYELEOS, 'bdenie': SIGN.VIGIL, 'velikoe-bdenie': SIGN.GREAT_VIGIL };
export function signGlyph(sign: string) { return SIGN_GLYPHS[SIGNS[sign]]; }
export default function DayTitle({ day }: {
    day: ParishDay;
}) {
    const selected = day.dayConfig?.memories;
    const memories = selected?.length ? selected.map(id => day.memoryChoices?.find(m => m.memoryId === id) ?? { memoryId: id, label: day.memories.find(m => m.memoryId === id)?.label ?? id }) : day.memories.slice(0, 1);
    return <div>{day.triodLabel && <div>{day.triodLabel}</div>}{memories.map((m, i) => {
            const sign = i === 0 ? day.sign : day.memoryChoices?.find(n => n.memoryId === m.memoryId)?.sign ?? '', glyph = signGlyph(sign);
            return <div key={m.memoryId}>{['polieley','bdenie','velikoe-bdenie'].includes(sign)?<strong>{m.label}</strong>:m.label}{glyph && <span aria-label="Знак службы" style={{ color: glyph.color === 'red' ? '#b21f1f' : '#000', fontFamily: '"Noto Sans Symbols 2", "Segoe UI Symbol", serif', marginLeft: '.3em' }}>{glyph.glyph}</span>}</div>;
        })}</div>;
}
