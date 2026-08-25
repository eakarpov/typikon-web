import {NextRequest, NextResponse} from "next/server";
import {getSession} from "@/lib/authorize/sessions";
import {getFavourites, mergeFavourites} from "@/app/api/favourites/service";
import {normaliseTextIds, TooManyFavouritesError} from "@/lib/favourites";

/**
 * Первый вход с устройства, где избранное уже накопилось.
 *
 * Список вливается, а не затирает серверный и не затирается им: отмечать
 * тексты можно и не входя в аккаунт, и с другого устройства. В ответ уходит
 * объединённый список — приложению он сразу нужен как новое состояние.
 */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return new NextResponse(null, {status: 401});
    }

    const body = await request.json().catch(() => null);

    let textIds: string[];
    try {
        textIds = normaliseTextIds(body?.textIds);
    } catch (error) {
        if (error instanceof TooManyFavouritesError) {
            return new NextResponse(null, {status: 413});
        }
        throw error;
    }

    await mergeFavourites(session.id, textIds);
    return NextResponse.json(await getFavourites(session.id), {status: 200});
}
