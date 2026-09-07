import { NextRequest, NextResponse } from "next/server";
import { viewer } from "@/lib/rights-server";
import { sendMail } from "@/lib/mail";
import {
    checkDomain, claimOf, claimsByStatus, createCommemorator,
    decideClaim, markLetterSent, markReplied,
} from "@/lib/pomyannik/commemorators";
import { SITE_HOST, SITE_URL } from "@/utils/site";

// РАЗБОР ЗАЯВОК НА ПРИЁМ ЗАПИСОК.
//
// Просит `commemoration.claims` — не «администратора вообще»: разбирающий здесь
// звонит в благочиние и читает ответное письмо, и ни расписание приходов, ни
// разбор книг ему для этого не нужны.
//
// Ящика мы пока НЕ ЧИТАЕМ. Письмо с кодом уходит машиной, ответ сверяет
// человек глазами и жмёт «ответ получен». Читать почту по IMAP имеет смысл,
// когда заявок станет больше десятка в неделю; до тех пор это работа на пустом
// месте.

const BASE_URL = `${SITE_URL}`;

export async function GET() {
    const { userId, caps } = await viewer();
    if (!userId || !caps.has("commemoration.claims")) {
        return NextResponse.json({ error: "нельзя" }, { status: userId ? 403 : 401 });
    }

    const claims = await claimsByStatus(["pending", "letter-sent", "verified"]);
    return NextResponse.json(claims.map(claim => ({
        ...claim,
        // Знак разбирающему нужен: он сверяет его с тем, что пришло в ответе.
        domain: checkDomain(claim.dioceseUrl, claim.email),
    })));
}

export async function POST(request: NextRequest) {
    const { userId, caps } = await viewer();
    if (!userId || !caps.has("commemoration.claims")) {
        return NextResponse.json({ error: "нельзя" }, { status: userId ? 403 : 401 });
    }

    const body = await request.json().catch(() => null);
    const target = String(body?.userId ?? "");
    const action = String(body?.action ?? "");
    const note = String(body?.note ?? "").trim() || undefined;
    if (!target) return NextResponse.json({ error: "нет заявки" }, { status: 400 });

    const claim = await claimOf(target);
    if (!claim) return NextResponse.json({ error: "заявки нет" }, { status: 404 });

    if (action === "letter") {
        const mailed = await sendMail(claim.email, `Приём записок на ${SITE_HOST}`,
            `Здравствуйте.\n\n`
            + `На ${SITE_HOST} подана заявка на приём поминальных записок от имени:\n`
            + `${claim.title}\n\n`
            + `Указана страница епархии: ${claim.dioceseUrl}\n\n`
            + `Если заявку подавали вы — ОТВЕТЬТЕ на это письмо, оставив в тексте\n`
            + `этот код подтверждения:\n\n    ${claim.token}\n\n`
            + `Ответ с адреса в домене епархии — то единственное, чем мы можем\n`
            + `удостовериться, что заявку подали именно вы. Сан мы не проверяем и\n`
            + `не удостоверяем: за него отвечает епархия.\n\n`
            + `Если вы этой заявки не подавали — просто не отвечайте, и ничего не\n`
            + `произойдёт. Можете и написать нам об этом, тогда мы её отклоним.\n`);
        await markLetterSent(target);
        return NextResponse.json({ ok: true, mailed });
    }

    if (action === "replied") {
        await markReplied(target, note ?? "ответ получен, код сошёлся");
        return NextResponse.json({ ok: true });
    }

    if (action === "approve") {
        // ПОРЯДОК ВАЖЕН: сперва заводим принимающего, потом отмечаем решение.
        // Упади мы посередине — лучше принятая заявка без права (её видно и
        // можно повторить), чем право без следа о том, кто и почему его дал.
        const person = await createCommemorator(claim, userId);
        await decideClaim(target, "approved", userId, note);
        await sendMail(claim.email, "Приём записок открыт",
            `Заявка принята: вы можете принимать поминальные записки на ${SITE_HOST}.\n\n`
            + `${note ? note + "\n\n" : ""}`
            + `Ссылка-приглашение для прихожан — её можно раздать или повесить\n`
            + `на стенде:\n${BASE_URL}/pomyannik/podat/${person.inviteCode}\n\n`
            + `Поданные записки: ${BASE_URL}/pomyannik/prinyatye\n`
            + `Там же можно открыть приём для всех — тогда вы попадёте в общий\n`
            + `список на ${BASE_URL}/pominovenie\n\n`
            + `Оплат на сайте нет: записка приходит к вам напрямую, и ни мы, ни\n`
            + `приход в этом не участвуем.\n`);
        return NextResponse.json({ ok: true, commemorator: person });
    }

    if (action === "reject") {
        await decideClaim(target, "rejected", userId, note);
        await sendMail(claim.email, "Заявка на приём записок",
            `К сожалению, заявку на приём поминальных записок мы не приняли.\n\n`
            + `${note ? "Причина: " + note + "\n\n" : ""}`
            + `Если это недоразумение — ответьте на это письмо, разберёмся.\n`);
        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "непонятное действие" }, { status: 400 });
}
