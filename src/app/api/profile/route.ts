import {getSession} from "@/lib/authorize/sessions";
import {NextRequest, NextResponse} from "next/server";
import {setItem} from "@/app/profile/api";

export async function POST(request: NextRequest) {
    const sessionDb = await getSession();

    if (!sessionDb) {
        return new NextResponse(null, {
            status: 400,
        });
    }
    const body = await request.json();

    const [res] = await setItem(body.id, body.data);

    if (res) {
        return NextResponse.json(null, {
            status: 200,
        });
    }

    return NextResponse.json(null, {
        status: 400,
    });
}
