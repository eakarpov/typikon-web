import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CacheTag } from "@/lib/cache";
import { rightsOn } from "@/lib/parish/access";
import { publishMonth, unpublishMonth } from "@/lib/parish/publish";
import { parishSchedule } from "@/lib/parish/schedule";

// «Этот месяц готов» — и обратно. Снимок кладётся тем, что ответственный видит
// перед собою в этот миг: устав, приходские правила и его собственные правки,
// уже сложенные вместе.
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    const { slug } = await ctx.params;
    const rights = await rightsOn(slug);
    if (!rights.canEdit) {
        return NextResponse.json(
            { error: rights.userId ? "этот храм ведёте не вы" : "войдите" },
            { status: rights.userId ? 403 : 401 });
    }

    const body = await request.json().catch(() => null);
    const month = String(body?.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: "нет месяца" }, { status: 400 });
    }

    if (body?.unpublish) {
        await unpublishMonth(slug, month);
        revalidateTag(CacheTag.PARISH);
        return NextResponse.json({ status: "draft" });
    }

    const data = await parishSchedule(slug, month);
    if (!data || data.unavailable) {
        // Публиковать нечего — и молча делать вид, что опубликовали, нельзя:
        // на стенде окажется пустой лист
        return NextResponse.json(
            { error: "устав не ответил — публиковать нечего" }, { status: 503 });
    }
    await publishMonth(slug, month, data.days, rights.userId!);
    revalidateTag(CacheTag.PARISH);
    return NextResponse.json({ status: "published", days: data.days.length });
}
