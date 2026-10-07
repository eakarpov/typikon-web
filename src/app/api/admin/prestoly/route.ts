import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { viewer } from "@/lib/rights-server";
import { CacheTag } from "@/lib/cache";
import {
    setPrestolGroupStatus, setPrestolStatus, setTempleFindingsStatus, type PrestolStatus,
} from "@/lib/pilgrimage/prestolReview";

// Разбор находок престолов: принять/отклонить одну находку, класс посвящения
// целиком или всё, что ждёт разбора у храма. Право — `content`, как у всякой
// правки собрания; в разработке открыто (@/lib/admin).
//
// Кэш сбрасываем тегом каталога: по престолам строятся выборки посвящений
// (@/lib/temples, CacheTag.TEMPLES).

const STATUSES: PrestolStatus[] = ["pending", "approved", "rejected"];

export const POST = async (request: NextRequest) => {
    const dev = process.env.NODE_ENV === "development";
    const { userId, caps } = await viewer();
    if (!dev && (!userId || !caps.has("content"))) {
        return NextResponse.json({ error: "нельзя" }, { status: userId ? 403 : 401 });
    }

    const body = await request.json().catch(() => null);
    const action = String(body?.action ?? "");
    const status = body?.status as PrestolStatus;
    if (!STATUSES.includes(status)) {
        return NextResponse.json({ errors: ["неведомый статус"] }, { status: 400 });
    }

    let touched: number;
    if (action === "finding") {
        const slug = String(body?.slug ?? "");
        const dedication = String(body?.dedication ?? "");
        if (!slug || !dedication) return NextResponse.json({ errors: ["нет находки"] }, { status: 400 });
        touched = await setPrestolStatus(slug, dedication, status, userId);
    } else if (action === "group") {
        const dedication = String(body?.dedication ?? "");
        const source = String(body?.source ?? "");
        if (!dedication || !source) return NextResponse.json({ errors: ["нет класса"] }, { status: 400 });
        touched = await setPrestolGroupStatus(dedication, source, status, userId);
    } else if (action === "temple") {
        const slug = String(body?.slug ?? "");
        if (!slug) return NextResponse.json({ errors: ["нет храма"] }, { status: 400 });
        touched = await setTempleFindingsStatus(slug, status, userId);
    } else {
        return NextResponse.json({ errors: ["неизвестное действие"] }, { status: 400 });
    }

    if (!touched) return NextResponse.json({ errors: ["нечего менять"] }, { status: 404 });
    revalidateTag(CacheTag.TEMPLES);
    return NextResponse.json({ ok: true, touched });
};
