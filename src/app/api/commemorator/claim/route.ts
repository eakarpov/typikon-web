import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { checkDomain, claimOf, saveClaim } from "@/lib/pomyannik/commemorators";
import { consume } from "@/lib/rateLimit";

// ЗАЯВКА НА ПРИЁМ ЗАПИСОК.
//
// Ссылка на страницу епархии и адрес почты в её домене — оба обязательны, и
// оба по существу: ссылка говорит, что священник с таким именем есть, письмо —
// что заявитель это он. Порознь они не доказывают ничего (см. lib/pomyannik/
// commemorators).
//
// Сличение домена мы ПОКАЗЫВАЕМ заявителю сразу, а не прячем до разбора: если
// он указал почту на общей службе, пусть лучше поправит теперь, чем узнает об
// этом через неделю отказом.

export async function GET() {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const claim = await claimOf(session.id);
    if (!claim) return NextResponse.json(null);
    // Знак наружу не отдаём: он ушёл письмом, и место ему в почте, а не в
    // ответе ручки, который видно всякому расширению браузера.
    const { token, ...rest } = claim;
    return NextResponse.json(rest);
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const rate = consume(`commemorator-claim:${session.id}`, 5, 3600);
    if (!rate.allowed) {
        return NextResponse.json({ error: "слишком часто; попробуйте позже" },
            { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    }

    const body = await request.json().catch(() => null);
    const title = String(body?.title ?? "").trim().slice(0, 120);
    const dioceseUrl = String(body?.dioceseUrl ?? "").trim().slice(0, 300);
    const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 200);

    if (!title) return NextResponse.json({ error: "назовите себя: сан и имя" }, { status: 400 });
    if (!dioceseUrl) {
        return NextResponse.json(
            { error: "нужна ссылка на страницу епархии, где вы названы" }, { status: 400 });
    }
    const domain = checkDomain(dioceseUrl, email);
    if (domain.match === "unknown") {
        return NextResponse.json({ error: domain.note }, { status: 400 });
    }

    const claim = await saveClaim({
        userId: session.id, title, dioceseUrl, email,
        phone: String(body?.phone ?? "").trim().slice(0, 60) || null,
        evidence: String(body?.evidence ?? "").trim().slice(0, 1000) || null,
    });

    const { token, ...rest } = claim;
    return NextResponse.json({ claim: rest, domain }, { status: 201 });
}
