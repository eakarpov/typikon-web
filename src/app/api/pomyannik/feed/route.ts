import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { getFeed, setFeed } from "@/lib/pomyannik/service";

export async function GET() {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const feed = await getFeed(session.id);
    return NextResponse.json(feed ? { token: feed.token, withNames: feed.withNames,
                                      lastUsedAt: feed.lastUsedAt } : null);
}

/** Завести ленту, сменить ей адрес или убрать из неё имена. */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const feed = await setFeed(session.id, {
        reset: body?.reset === true,
        withNames: typeof body?.withNames === "boolean" ? body.withNames : undefined,
    });

    return NextResponse.json({ token: feed.token, withNames: feed.withNames });
}
