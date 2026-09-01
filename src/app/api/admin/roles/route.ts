import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ROLES } from "@/lib/rights";
import { viewer } from "@/lib/rights-server";

// Раздача прав. Просит `roles.grant` — возможность, которую до сих пор никто
// не спрашивал: права раздавались только командой с сервера, и заведённая
// возможность висела без применения.
export async function POST(request: NextRequest) {
    const { userId, caps } = await viewer();
    if (!userId || !caps.has("roles.grant")) {
        return NextResponse.json({ error: "нельзя" }, { status: userId ? 403 : 401 });
    }
    const body = await request.json().catch(() => null);
    const email = String(body?.email ?? "").trim();
    const role = String(body?.role ?? "").trim();
    const remove = Boolean(body?.remove);
    if (!email || !ROLES[role]) {
        return NextResponse.json({ error: "нужны почта и известная роль" }, { status: 400 });
    }

    const users = (await clientPromise).db("typikon-users").collection("users");
    const user = await users.findOne({ email });
    if (!user) {
        return NextResponse.json(
            { error: "такого пользователя нет — пусть сперва войдёт на сайт" }, { status: 404 });
    }

    const roles = new Set<string>((user.roles as string[]) ?? []);
    if (user.isAdmin) roles.add("admin");
    if (remove) roles.delete(role); else roles.add(role);

    // ПОСЛЕДНЕГО АДМИНИСТРАТОРА НЕ СНИМАЕМ — ни отсюда, ни командой: сайт
    // некому будет открыть, и вернуть право будет неоткуда
    if (remove && role === "admin") {
        const others = await users.countDocuments({
            _id: { $ne: user._id }, $or: [{ roles: "admin" }, { isAdmin: true }],
        });
        if (!others) {
            return NextResponse.json(
                { error: "это последний администратор — сперва назначьте другого" },
                { status: 409 });
        }
    }
    // СЕБЯ РАЗЖАЛОВАТЬ НЕЛЬЗЯ по ошибке: снять с себя право раздавать права
    // значит запереть дверь изнутри
    if (remove && String(user._id) === userId && ROLES[role].caps !== "*"
        && (ROLES[role].caps as string[]).includes("roles.grant")) {
        return NextResponse.json({ error: "нельзя снять это право с себя" }, { status: 409 });
    }

    await users.updateOne({ _id: user._id },
        { $set: { roles: [...roles] }, $unset: { isAdmin: "" } });
    return NextResponse.json({ ok: true, roles: [...roles] });
}
