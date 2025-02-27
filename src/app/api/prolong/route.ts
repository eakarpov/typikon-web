import {getSession} from "@/lib/authorize/sessions";
import {NextResponse} from "next/server";

export async function POST() {
    const sessionDb = await getSession();

    if (!sessionDb) {
        return new NextResponse(null, {
            status: 400,
        });
    }
    const vkInfo = sessionDb.auth?.vk;
    return new NextResponse(vkInfo, {
        status: 200,
    });
}
