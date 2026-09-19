import {getSession} from "@/lib/authorize/sessions";
import {NextResponse} from "next/server";

export async function POST() {
    const sessionDb = await getSession();

    if (!sessionDb) {
        return new NextResponse(null, {
            status: 400,
        });
    }
    // Наружу — только то, чем VK ID SDK продлевает вход: токен продления и
    // устройство. Прочее содержимое сессии странице незачем.
    const vk = sessionDb.auth?.vk;
    const vkInfo = vk ? { state: { refresh_token: vk.state?.refresh_token }, deviceId: vk.deviceId } : null;
    return NextResponse.json(vkInfo, {
        status: 200,
    });
}
