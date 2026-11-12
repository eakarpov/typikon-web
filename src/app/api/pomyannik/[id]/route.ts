import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { PersonDataError, deletePerson, getPerson, updatePerson } from "@/lib/pomyannik/service";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const { id } = await ctx.params;
    const person = await getPerson(session.id, id);
    if (!person) return new NextResponse(null, { status: 404 });
    return NextResponse.json(person);
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "не разобрали тело запроса" }, { status: 400 });
    }

    try {
        const person = await updatePerson(session.id, id, body);
        if (!person) return new NextResponse(null, { status: 404 });
        return NextResponse.json(person);
    } catch (e) {
        if (e instanceof PersonDataError) return NextResponse.json({ error: e.message }, { status: 400 });
        throw e;
    }
}

export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const { id } = await ctx.params;
    const deleted = await deletePerson(session.id, id);
    return new NextResponse(null, { status: deleted ? 200 : 404 });
}
