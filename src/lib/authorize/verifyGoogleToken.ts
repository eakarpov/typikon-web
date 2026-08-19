import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

// Проверяет подпись и audience Google id_token — раньше /api/login доверял
// user_id, присланному клиентом напрямую, без какой-либо проверки.
// audience — тот же web client id (GOOGLE_APP), что и на клиенте; мобильное
// приложение получает id_token именно с этой audience через serverClientId.
export const verifyGoogleIdToken = async (idToken: string) => {
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_APP!,
        });
        return ticket.getPayload();
    } catch (e) {
        console.error(e);
        return undefined;
    }
};
