import {decrypt, deleteSession} from "@/lib/authorize/sessions";
import {redirect} from "next/navigation";
import {cookies} from "next/headers";
import {NextRequest, NextResponse} from "next/server";

export async function POST(request: NextRequest) {
    const cookieStore = await cookies()
    const cookie = cookieStore.get('session')?.value;
    const session = await decrypt(cookie);
    cookieStore.delete('session');
    await deleteSession(session);

    // лишнее, убрать
    redirect('/login');

    return new NextResponse(null, {
        status: 200,
    });
}
