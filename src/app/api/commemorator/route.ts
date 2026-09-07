import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { revalidatePath } from "next/cache";
import { commemoratorOf, updateCommemorator } from "@/lib/pomyannik/commemorators";

// Что священник о себе правит сам. Сан, епархия и самоё право отсюда не
// меняются: их дал разбор заявки, и переписать их своей рукой нельзя.

export async function GET() {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });
    return NextResponse.json(await commemoratorOf(session.id));
}

export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "не разобрали тело запроса" }, { status: 400 });
    }

    const updated = await updateCommemorator(session.id, {
        place: body.place,
        about: body.about,
        accepts: body.accepts,
        public: body.public,
        resetCode: body.resetCode === true,
    });
    if (!updated) return new NextResponse(null, { status: 404 });

    // Открытый список пересобирается раз в час, и священник, только что
    // открывший приём, себя бы в нём не нашёл — а решил бы, что не сработало.
    // Сбрасываем страницу сразу: правка эта редкая, и жалеть на неё нечего.
    revalidatePath("/pominovenie");
    revalidatePath(`/pominovenie/${updated.slug}`);

    return NextResponse.json(updated);
}
