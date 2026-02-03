import {
    getUserByGoogleId,
    getUserByVKId,
    registerNewUserWithGoogle,
    registerNewUserWithVK
} from "@/lib/authorize/users";
import {createNewSession} from "@/lib/authorize/sessions";
import {NextRequest, NextResponse} from "next/server";

export async function POST(request: NextRequest) {
    const body = await request.json();
    // const body = req;
    // const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (body.type === "VK") {
        let user = await getUserByVKId(body.data.user_id);
        if (!user) {
            // register
            await registerNewUserWithVK(body.data.user_id);
            user =  await getUserByVKId(body.data.user_id);
        }
        // 3. Store the session in cookies for optimistic auth checks
        const expiresAt = await createNewSession(user!._id?.toString(), body.data, "" as string, body.timestamp, body.deviceId);
        return NextResponse.json({
            userId: user!._id?.toString(),
            expiresAt,
        }, {
            status: 200,
            headers: {
                'Access-Control-Expose-Headers': 'Set-Cookie'
            }
        });
    } else if (body.type === "Google") {
        let user = await getUserByGoogleId(body.data.user_id);
        if (!user) {
            // register
            await registerNewUserWithGoogle(body.data.user_id);
            user =  await getUserByGoogleId(body.data.user_id);
        }
        // 3. Store the session in cookies for optimistic auth checks
        const expiresAt = await createNewSession(user!._id?.toString(), body.data, "" as string, body.timestamp, body.deviceId);
        return NextResponse.json({
            userId: user!._id?.toString(),
            expiresAt,
        }, {
            status: 200,
            headers: {
                'Access-Control-Expose-Headers': 'Set-Cookie'
            }
        });
    } else {
        return new NextResponse(null, {
            status: 400,
        });
    }
}
