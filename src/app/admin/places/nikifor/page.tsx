import Link from "next/link";
import { hasAdminRights } from "@/lib/admin";
import { getArticleGroups } from "@/app/admin/places/nikifor/api";
import ArticleGroupItem from "@/app/admin/places/nikifor/ArticleGroupItem";

// Ревью пар «место ↔ статья энциклопедии Никифора». Кандидатов оставляет
// `npm run places:link-nikifor -- --write`, когда сам не решается; решение записывается
// в место сразу и повторным прогоном не перезаписывается (@/lib/places/nikiforReview).
const AdminNikiforCandidates = async ({ searchParams }: { searchParams: { all?: string } }) => {
    const all = searchParams.all === "1";
    const [groups, error] = await getArticleGroups(!all);
    if (error || !groups) return <div>Ошибка получения</div>;

    const total = groups.reduce((n, g) => n + g.candidates.length, 0);
    const pending = groups.reduce((n, g) => n + g.pending, 0);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1">
                <p className="font-bold">Статьи Никифора и места — ревью</p>
                <p className="text-sm text-slate-600">
                    Сопоставление само не решилось: статья подошла нескольким местам, или общих стихов мало,
                    или имя подошло нескольким статьям. Одна статья может быть принята у нескольких мест —
                    «Кармил» описывает и город, и гору. Принятая статья даёт месту библейское имя, а месту с
                    английским именем — и русское, и открытую страницу.
                </p>
            </div>
            <div className="flex flex-row gap-4 items-center text-sm">
                <span>статей {groups.length} · пар {total} · не разобрано {pending}</span>
                {all
                    ? <Link href="/admin/places/nikifor" className="underline">только неразобранное</Link>
                    : <Link href="/admin/places/nikifor?all=1" className="underline">показать и разобранное</Link>}
            </div>
            {!groups.length && <p>Неразобранного нет.</p>}
            {groups.map((g) => <ArticleGroupItem key={g.alias} group={g} />)}
        </div>
    );
};

export default hasAdminRights(AdminNikiforCandidates);
