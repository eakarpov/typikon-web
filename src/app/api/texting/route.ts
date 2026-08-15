import {NextRequest, NextResponse} from "next/server";
import {getSession} from "@/lib/authorize/sessions";
import {createProposal} from "@/app/api/texting/service";

export async function POST(request: NextRequest) {
    const sessionDb = await getSession();

    if (!sessionDb) {
        return new NextResponse(null, {
            status: 401,
        });
    }

    const body = await request.json();

    if (!body.textId || !body.content || !body.content.trim()) {
        return new NextResponse(null, {
            status: 400,
        });
    }

    const [, error] = await createProposal({
        userId: sessionDb.id,
        textId: body.textId,
        content: body.content,
        comment: body.comment,
    });

    if (error) {
        return new NextResponse(null, {
            status: 400,
        });
    }

    return NextResponse.json(null, {
        status: 200,
    });
}
