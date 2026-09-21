import {NextRequest, NextResponse} from "next/server";
import {getSession} from "@/lib/authorize/sessions";
import {createProposal} from "@/app/api/texting/service";
import {isId, isOptionalText, isText} from "@/lib/api/bodyLimits";

// Предложение — целый текст, и текст бывает длинным; предел стоит от ошибки и
// злоупотребления, а не от настоящей работы.
const CONTENT_MAX = 1_000_000;

export async function POST(request: NextRequest) {
    const sessionDb = await getSession();

    if (!sessionDb) {
        return new NextResponse(null, {
            status: 401,
        });
    }

    const body = await request.json().catch(() => null);

    if (!body || !isId(body.textId) || !isText(body.content, CONTENT_MAX) || !isOptionalText(body.comment, 5000)) {
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
