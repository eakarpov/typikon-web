import { renderNamedPrayer, type NamedPerson } from '@/lib/molitvoslov/named';
import type { PersonKind } from '@/lib/pomyannik/types';
import type { Row } from './core';
/** Подставляем имена только в установленные книжные места; прочие молитвы не меняем. */
export function fillMorningCommemorations(rows:Row[],ids:Map<string,PersonKind>,names:Record<PersonKind,NamedPerson[]>,gender:'m'|'f'):Row[] {
    return rows.map(row=>{
        const kind=row.sourceTextId?ids.get(row.sourceTextId):undefined;
        return kind?{...row,text:renderNamedPrayer(row.text,names[kind],gender)}:row;
    });
}
