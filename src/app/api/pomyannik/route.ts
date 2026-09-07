import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { addPersons, listPersons, TooManyPersonsError } from "@/lib/pomyannik/service";
import type { PersonInput } from "@/lib/pomyannik/types";

// Помянник целиком и запись имён — одним или пачкой.
//
// `session.id` — это userId: так заведено в lib/authorize/sessions, где документ
// сессии лежит под ключом пользователя. Читается непривычно, но переименовывать
// его отсюда нельзя.

export async function GET() {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    return NextResponse.json(await listPersons(session.id));
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "не разобрали тело запроса" }, { status: 400 });

    // Одно имя и пачка приходят одной ручкой: страница массового ввода и
    // быстрая строка внизу помянника делают одно и то же дело.
    const inputs: PersonInput[] = Array.isArray(body) ? body
        : Array.isArray(body.persons) ? body.persons
        : [body];

    try {
        const created = await addPersons(session.id, inputs);
        if (!created.length) {
            return NextResponse.json({ error: "имени в присланном не нашлось" }, { status: 400 });
        }
        return NextResponse.json({ persons: created }, { status: 201 });
    } catch (e) {
        if (e instanceof TooManyPersonsError) {
            return NextResponse.json({ error: e.message }, { status: 409 });
        }
        throw e;
    }
}
