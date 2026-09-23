import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { viewer } from "@/lib/rights-server";
import { CacheTag } from "@/lib/cache";
import { createFromProposal, dismissProposal, mergeProposal } from "@/lib/saintProposals";

// Решение по предложению святого: завести, присоединить к записи, отклонить.
// Право — `content`, как у всякой правки собрания; в разработке открыто.
export const POST = async (request: NextRequest) => {
    const dev = process.env.NODE_ENV === "development";
    const { userId, caps } = await viewer();
    if (!dev && (!userId || !caps.has("content"))) {
        return NextResponse.json({ error: "нельзя" }, { status: userId ? 403 : 401 });
    }
    const body = await request.json().catch(() => null);
    const id = String(body?.id ?? "");
    let result: Record<string, unknown>;
    if (body?.action === "create") result = await createFromProposal(id, String(body?.name ?? ""));
    else if (body?.action === "merge") result = await mergeProposal(id, String(body?.address ?? ""));
    else if (body?.action === "dismiss") result = (await dismissProposal(id)) ? { ok: true } : { error: "нет такого предложения" };
    else return NextResponse.json({ error: "неизвестное действие" }, { status: 400 });
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    revalidateTag(CacheTag.SAINTS);
    return NextResponse.json({ ok: true, ...result });
};
