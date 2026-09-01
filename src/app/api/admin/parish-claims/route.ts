import { NextRequest, NextResponse } from "next/server";
import { decideClaim } from "@/lib/parish/claims";
import { addAdmin } from "@/lib/parish/access";
import { viewer } from "@/lib/rights-server";

// Решение модератора по заявке. Отдельно от приходских ручек: там право
// приходское и именное, здесь — сайта, и просит оно `parish.claims`.
export async function POST(request: NextRequest) {
    const { userId, caps } = await viewer();
    if (!userId || !caps.has("parish.claims")) {
        return NextResponse.json({ error: "нельзя" }, { status: userId ? 403 : 401 });
    }
    const body = await request.json().catch(() => null);
    const id = String(body?.id ?? "");
    const approve = Boolean(body?.approve);
    if (!id) return NextResponse.json({ error: "нет заявки" }, { status: 400 });

    const [templeSlug, claimUser] = id.split(":");
    await decideClaim(id, approve ? "approved" : "rejected", userId,
                      String(body?.note ?? "").trim() || undefined);
    if (approve) await addAdmin(templeSlug, claimUser, userId);
    return NextResponse.json({ ok: true });
}
