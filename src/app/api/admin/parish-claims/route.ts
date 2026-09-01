import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { decideClaim } from "@/lib/parish/claims";
import { addAdmin } from "@/lib/parish/access";
import { getTemple } from "@/lib/temples";
import { viewer } from "@/lib/rights-server";
import { sendMail } from "@/lib/mail";

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
    const note = String(body?.note ?? "").trim() || undefined;
    if (!id) return NextResponse.json({ error: "нет заявки" }, { status: 400 });

    const [templeSlug, claimUser] = id.split(":");
    await decideClaim(id, approve ? "approved" : "rejected", userId, note);
    if (approve) await addAdmin(templeSlug, claimUser, userId);

    // РЕШЕНИЕ ДОХОДИТ ДО ЧЕЛОВЕКА. Прежде о нём знала одна база: заявитель
    // отправлял заявку и молчал в ожидании, а мы уже всё решили. Для пути
    // «разговором» это особенно скверно — он ждёт звонка, которого не будет.
    //
    // Письмо — не условие решения: оно уже записано и видно на странице. Не
    // ушло — жалуемся в лог и живём дальше.
    const mailed = await notify(claimUser, templeSlug, approve, note);
    return NextResponse.json({ ok: true, mailed });
}

const notify = async (
    claimUser: string, templeSlug: string, approve: boolean, note?: string,
): Promise<boolean> => {
    let email: string | null = null;
    try {
        const user = await (await clientPromise).db("typikon-users")
            .collection("users").findOne({ _id: new ObjectId(claimUser) });
        email = (user?.email as string) ?? null;
    } catch { /* почты нет — скажем на странице, она решение показывает */ }
    if (!email) return false;

    const temple = await getTemple(templeSlug);
    const name = temple?.name ?? templeSlug;
    const link = `https://www.typikon.su/parish/${templeSlug}`;

    return approve
        ? sendMail(email, `Расписание: ${name}`,
            `Ваша заявка принята — вы ведёте расписание храма «${name}».\n\n`
            + `${note ? note + "\n\n" : ""}`
            + `Расписание выводится из устава само; вам остаётся поправить часы\n`
            + `и сказать «этот месяц готов»:\n${link}\n`)
        : sendMail(email, `Заявка на ведение расписания: ${name}`,
            `К сожалению, заявку на ведение расписания храма «${name}» мы не приняли.\n\n`
            + `${note ? "Причина: " + note + "\n\n" : ""}`
            + `Если это недоразумение — ответьте на это письмо, разберёмся.\n`);
};
