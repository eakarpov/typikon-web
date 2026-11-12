import Link from "next/link";
import type { PomyannikPerson } from "@/lib/pomyannik/types";
import { displayName, humanDate } from "./labels";
export default function DuplicateHints({ persons }: { persons: PomyannikPerson[] }) {
    if (!persons.length) return null;
    return <div className="text-sm font-serif border border-amber-200 rounded p-2 space-y-1">
        <p>Есть похожие записи. Это могут быть разные люди — проверьте подписи и даты.</p>
        <ul>{persons.slice(0, 20).map(person => <li key={person.id}>
            <Link href={`/pomyannik/${person.id}`} className="underline">{displayName(person)}</Link>
            {person.signature && ` · ${person.signature}`}{person.relation && ` · ${person.relation}`}
            {person.born && ` · род. ${humanDate(person.born)}`}{person.died && ` · прест. ${humanDate(person.died)}`}
            {` · ${person.kind === "living" ? "о здравии" : "о упокоении"}`}
        </li>)}</ul>
        {persons.length > 20 && <p className="text-slate-500">Показаны первые 20 из {persons.length}. Уточните поиск в помяннике, чтобы найти нужную запись.</p>}
    </div>;
}
