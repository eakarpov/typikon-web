import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { viewer } from "@/lib/rights-server";
import { CacheTag } from "@/lib/cache";
import { validateRelic, type RelicStatus } from "@/lib/pilgrimage/relics";
import { createRelic, deleteRelic, inputFrom, setRelicStatus, updateRelic } from "@/lib/pilgrimage/relicsStore";
import { setCandidateStatus } from "@/lib/pilgrimage/candidates";

// Реестр святынь: запись и разбор. Право — `content`, как у всякой правки
// собрания. В разработке открыто, как и прочие админские страницы (@/lib/admin).
//
// Ручка в app-роутере, и сброс кэша — здесь же, тегом: ходить за ним в
// /api/revalidate, как админке pages-роутера, незачем.

const STATUSES: RelicStatus[] = ["pending", "approved", "rejected"];

export const POST = async (request: NextRequest) => {
    const dev = process.env.NODE_ENV === "development";
    const { userId, caps } = await viewer();
    if (!dev && (!userId || !caps.has("content"))) {
        return NextResponse.json({ error: "нельзя" }, { status: userId ? 403 : 401 });
    }

    const body = await request.json().catch(() => null);
    const action = String(body?.action ?? "");
    const id = String(body?.id ?? "");

    let result: Record<string, unknown>;
    if (action === "create" || action === "update") {
        const checked = validateRelic(await inputFrom(body?.relic));
        if (!checked.ok) return NextResponse.json({ errors: checked.errors }, { status: 400 });
        const saved = action === "create"
            ? await createRelic(checked.value, userId, "approved")
            : await updateRelic(id, checked.value, userId);
        if ("error" in saved) return NextResponse.json({ errors: [saved.error] }, { status: 400 });
        // Запись оформлена из находки обходчика — находка своё отслужила.
        if (action === "create" && body?.candidateId) await setCandidateStatus(String(body.candidateId), "used");
        result = { ok: true, ...saved };
    } else if (action === "status" && STATUSES.includes(body?.status)) {
        if (!(await setRelicStatus(id, body.status, userId))) return NextResponse.json({ errors: ["нет такой записи"] }, { status: 404 });
        result = { ok: true };
    } else if (action === "dismiss-candidate") {
        if (!(await setCandidateStatus(id, "dismissed"))) return NextResponse.json({ errors: ["нет такой находки"] }, { status: 404 });
        return NextResponse.json({ ok: true });
    } else if (action === "delete") {
        if (!(await deleteRelic(id))) return NextResponse.json({ errors: ["нет такой записи"] }, { status: 404 });
        result = { ok: true };
    } else {
        return NextResponse.json({ errors: ["неизвестное действие"] }, { status: 400 });
    }

    revalidateTag(CacheTag.RELICS);
    return NextResponse.json(result);
};
