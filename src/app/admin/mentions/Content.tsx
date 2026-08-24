import SaintGroupItem from "@/app/admin/mentions/SaintGroupItem";
import ApplyButton from "@/app/admin/mentions/ApplyButton";
import type { SaintGroup } from "@/app/admin/mentions/api";

const Content = async ({
    groupsPromise,
    appliedPromise,
}: {
    groupsPromise: Promise<[SaintGroup[] | null, any]>;
    appliedPromise: Promise<number>;
}) => {
    const [groups, error] = await groupsPromise;
    const applied = await appliedPromise;

    if (error || !groups) {
        return <div>Ошибка получения</div>;
    }

    const total = groups.reduce((n, g) => n + g.candidates.length, 0);
    const pending = groups.reduce((n, g) => n + g.pending, 0);
    const approved = groups.reduce((n, g) => n + g.approved, 0);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1">
                <p className="font-bold">Упоминания святых в чтениях — ревью</p>
                <p className="text-sm text-slate-600">
                    Кандидаты находит <code>npx tsx src/scripts/link-text-mentions.ts --save</code>.
                    Сопоставление автоматическое и ошибается примерно в половине случаев, поэтому
                    в <code>mentionIds</code> попадает только подтверждённое здесь.
                </p>
                <p className="text-sm text-slate-600">
                    Ошибки обычно идут группой: если у святого имя совпало с обычным словом
                    (&laquo;саввати&raquo; — это суббота, а не Савва) или с библейским тёзкой, мимо идёт
                    вся его пачка. Поэтому решать удобнее сразу по святому.
                </p>
            </div>

            <div className="flex flex-row gap-4 items-center flex-wrap">
                <span className="text-sm">
                    всего {total} · не разобрано {pending} · принято {approved} · уже проставлено {applied}
                </span>
                <ApplyButton approved={approved} />
            </div>

            {groups.length === 0 && (
                <p>
                    Кандидатов нет. Запустите <code>npx tsx src/scripts/link-text-mentions.ts --save</code>.
                </p>
            )}

            {groups.map((g) => (
                <SaintGroupItem key={g.dneslovId} group={g} />
            ))}
        </div>
    );
};

export default Content;
