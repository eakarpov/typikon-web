import { NextRequest, NextResponse } from "next/server";
import { getTemple } from "@/lib/temples";
import { addAdmin, adminsOf, currentUserId } from "@/lib/parish/access";
import { checkSite, myClaim, markChecked, saveClaim } from "@/lib/parish/claims";

// Заявка «я веду расписание этого храма» и проверка знака на сайте прихода.
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    const { slug } = await ctx.params;
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: "войдите" }, { status: 401 });

    const temple = await getTemple(slug);
    if (!temple) return NextResponse.json({ error: "нет такого храма" }, { status: 404 });

    const body = await request.json().catch(() => null);

    // ПРОВЕРКА ЗНАКА — второй заход по той же заявке
    if (body?.check) {
        const claim = await myClaim(slug, userId);
        if (!claim) return NextResponse.json({ error: "заявки нет" }, { status: 404 });
        const { ok, note } = await checkSite(temple, claim.token);
        await markChecked(claim._id!, ok, note);
        if (ok) {
            // ЗНАК СОШЁЛСЯ — И ЭТОГО ДОВОЛЬНО, если храм ещё никем не ведётся:
            // кто может править сайт прихода, тот и приход, и звать человека
            // подтверждать машинное «да» значило бы не верить самим себе
            const already = await adminsOf(slug);
            if (!already.length) {
                await addAdmin(slug, userId);
                return NextResponse.json({ ok: true, granted: true, note });
            }
            // …но не когда храм уже ведут: тогда решает тот, кто ведёт
            return NextResponse.json({ ok: true, granted: false, note });
        }
        return NextResponse.json({ ok: false, note }, { status: 200 });
    }

    const role = String(body?.role ?? "").trim();
    const contact = String(body?.contact ?? "").trim();
    if (!role || !contact) {
        return NextResponse.json(
            { error: "скажите, кто вы в приходе и как с вами связаться" }, { status: 400 });
    }

    const claim = await saveClaim({
        templeSlug: slug, userId, role, contact,
        evidence: String(body?.evidence ?? "").trim() || undefined,
        method: temple.website ? "site-token" : "manual",
    });
    return NextResponse.json({
        token: claim.token,
        // Сайт называем ТОТ, ЧТО В СПРАВОЧНИКЕ: проверка читает его, а не тот,
        // что назовёт заявитель, — иначе она ничего не проверяет
        website: temple.website ?? null,
        method: claim.method,
    });
}
