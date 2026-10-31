import { authorizeUser } from '@/lib/api/v2/user';
import { respondPrivate, fail } from '@/lib/api/v2/http';
import { readingPlanNotice } from '@/lib/readingPlan/mobile';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { const a = await authorizeUser(req, 'texts'); if (a.denied)
    return a.denied; try {
    return respondPrivate(await readingPlanNotice(a.userId, new URL(req.url).searchParams.get('delivery') || ''), { access: a });
}
catch {
    return fail('internal', 'Не удалось проверить напоминание.');
} }
