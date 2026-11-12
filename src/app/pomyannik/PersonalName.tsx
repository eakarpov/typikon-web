import { effectiveRanks } from "@/lib/pomyannik/marks";
import type { PomyannikPerson } from "@/lib/pomyannik/types";
import { displayName, humanDate, rankLabel } from "./labels";
export default function PersonalName({ person, signatures, relations, dates }: {
    person: PomyannikPerson; signatures: boolean; relations: boolean; dates: boolean;
}) {
    return <>
        <div>{[effectiveRanks(person).map(r => rankLabel(r,person.sex)).join(" "), displayName(person)].filter(Boolean).join(" ")}</div>
        {signatures && person.signature && <div className="text-[0.65em] text-slate-600">{person.signature}</div>}
        {relations && person.relation && <div className="text-[0.65em] text-slate-600">{person.relation}</div>}
        {dates && (person.born || person.died) && <div className="text-[0.6em] text-slate-600">
            {person.born && <>Род. {humanDate(person.born)}</>}{person.born && person.died && " · "}{person.died && <>Прест. {humanDate(person.died)}</>}
        </div>}
    </>;
}
