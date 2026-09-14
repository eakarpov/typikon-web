import Link from "next/link";
import { hasAdminRights } from "@/lib/admin";
import { getPlaceGroups } from "@/app/admin/places/mentions/api";
import PlaceGroupItem from "@/app/admin/places/mentions/PlaceGroupItem";

// Ревью упоминаний мест в текстах. Кандидатов находит `npm run places:link-texts --
// --write`: с признаком места рядом они принимаются сами, прочие ждут здесь.
const AdminPlaceMentions = async ({ searchParams }: { searchParams: { all?: string } }) => {
    const all = searchParams.all === "1";
    const [groups, error] = await getPlaceGroups(!all);
    if (error || !groups) return <div>Ошибка получения</div>;

    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const pending = groups.reduce((n, g) => n + g.pending, 0);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1">
                <p className="font-bold">Упоминания мест в чтениях — ревью</p>
                <p className="text-sm text-slate-600">
                    Здесь то, что поиск по имени не решился принять сам: рядом с именем нет признака
                    места («во граде», прилагательного), имя короткое или совпадает с человеком
                    (Иуда, Моав, Мира). Решение пишется сразу и повторным прогоном не перезаписывается.
                </p>
            </div>
            <div className="flex flex-row gap-4 items-center text-sm">
                <span>мест {groups.length} · упоминаний {total} · не разобрано {pending}</span>
                {all
                    ? <Link href="/admin/places/mentions" className="underline">только неразобранное</Link>
                    : <Link href="/admin/places/mentions?all=1" className="underline">показать и разобранное</Link>}
            </div>
            {!groups.length && <p>Неразобранного нет.</p>}
            {groups.map((g) => <PlaceGroupItem key={g.placeId} group={g} />)}
        </div>
    );
};

export default hasAdminRights(AdminPlaceMentions);
