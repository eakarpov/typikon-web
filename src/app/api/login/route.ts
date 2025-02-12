import {NextApiRequest} from "next";
import {getUserByVKId, registerNewUserWithVK} from "@/lib/authorize/users";
import {createNewSession} from "@/lib/authorize/sessions";
import {NextRequest, NextResponse} from "next/server";

export async function POST(request: NextRequest) {
    const body = await request.json();
    // const body = req;
    // const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(body, body.type);
    if (body.type === "VK") {
        let user = await getUserByVKId(body.data.user_id);
        if (!user) {
            // register
            await registerNewUserWithVK(body.data.user_id);
            user =  await getUserByVKId(body.data.user_id);
        }
        console.log(user);
        // 3. Store the session in cookies for optimistic auth checks
        await createNewSession(user!.id, body.data, "" as string, body.timestamp);
        return new NextResponse(null, {
            status: 200,
        });
    } else {
        return new NextResponse(null, {
            status: 400,
        });
    }
}
