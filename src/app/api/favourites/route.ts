import {NextRequest, NextResponse} from "next/server";
import {getSession} from "@/lib/authorize/sessions";
import {addFavourite, getFavourites} from "@/app/api/favourites/service";

export async function GET() {
    const session = await getSession();
    if (!session) {
        return new NextResponse(null, {status: 401});
    }

    const favourites = await getFavourites(session.id);
    return NextResponse.json(favourites, {status: 200});
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return new NextResponse(null, {status: 401});
    }

    const body = await request.json().catch(() => null);
    const textId = typeof body?.textId === "string" ? body.textId.trim() : "";
    if (!textId) {
        return new NextResponse(null, {status: 400});
    }

    // Повторное добавление — не ошибка: приложение досылает отметки из
    // офлайн-очереди, не зная, дошла ли предыдущая попытка.
    const added = await addFavourite(session.id, textId);
    if (!added) {
        return new NextResponse(null, {status: 400});
    }
    return new NextResponse(null, {status: 200});
}
