import {getSession} from "@/lib/authorize/sessions";
import {NextRequest, NextResponse} from "next/server";
import {emailTakenByAnother, setItem} from "@/app/profile/api";
import {sanitizeProfilePatch} from "@/lib/authorize/profileFields";

// Чья запись правится, решает сессия, а не тело запроса; что в ней правится —
// белый список из lib/authorize/profileFields. Поле `id` из тела не читается.
export async function POST(request: NextRequest) {
    const sessionDb = await getSession();

    if (!sessionDb?.id) {
        return new NextResponse(null, {
            status: 401,
        });
    }
    const body = await request.json().catch(() => null);
    const patch = sanitizeProfilePatch(body?.data);

    if (!patch) {
        return NextResponse.json(null, {
            status: 400,
        });
    }

    // По почте ищут пользователя выдача ролей и приглашения приходов: одна почта
    // у двух записей значила бы, что право достанется не тому.
    if (patch.email && await emailTakenByAnother(sessionDb.id, patch.email)) {
        return NextResponse.json({ error: "email-taken" }, {
            status: 409,
        });
    }

    const [res] = await setItem(sessionDb.id, patch);

    if (res) {
        return NextResponse.json(null, {
            status: 200,
        });
    }

    return NextResponse.json(null, {
        status: 400,
    });
}
