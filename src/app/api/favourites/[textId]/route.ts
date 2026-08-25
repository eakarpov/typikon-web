import {NextRequest, NextResponse} from "next/server";
import {getSession} from "@/lib/authorize/sessions";
import {removeFavourite} from "@/app/api/favourites/service";

// Ключ — textId, а не id записи: приложение знает текст, но не знает, под каким
// _id он лежит в коллекции, и лишний поход за этим ему ни к чему.
export async function DELETE(request: NextRequest, {params}: {params: {textId: string}}) {
    const session = await getSession();
    if (!session) {
        return new NextResponse(null, {status: 401});
    }

    const removed = await removeFavourite(session.id, params.textId);
    if (!removed) {
        return new NextResponse(null, {status: 400});
    }
    // Записи могло не быть вовсе — это тоже успех: пользователь хотел, чтобы
    // текста в избранном не было, и его там нет.
    return new NextResponse(null, {status: 200});
}
