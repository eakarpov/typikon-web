import { OAuth2Client } from "google-auth-library";
import {reportError} from "@/lib/reportError";

const client = new OAuth2Client();

/**
 * Кому должен быть выписан токен. Список, а не одно значение, и это НЕ
 * послабление проверки: audience сверяется по-прежнему строго, просто
 * допустимых получателей на время переезда двое.
 *
 * Зачем. У Google клиент привязан к списку источников, и для нового адреса
 * заведён новый; старый адрес продолжает работать прежним. Вдобавок — и это
 * важнее — **уже выпущенное мобильное приложение** получает токен через
 * serverClientId, зашитый в его сборку, то есть со СТАРОЙ audience. Оставь мы
 * здесь один новый клиент — вход через Google в приложении отвалился бы у всех
 * в день выкладки, а не в январе, и починить это можно было бы только выпуском.
 *
 * GOOGLE_APP_OLD снимается вместе с остальным переездным, но позже прочего:
 * сначала должно разойтись приложение с новым serverClientId.
 */
const audience = (): string[] => [
    process.env.GOOGLE_APP!,
    process.env.GOOGLE_APP_OLD,
].filter((value): value is string => !!value);

// Проверяет подпись и audience Google id_token — раньше /api/login доверял
// user_id, присланному клиентом напрямую, без какой-либо проверки.
export const verifyGoogleIdToken = async (idToken: string) => {
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: audience(),
        });
        return ticket.getPayload();
    } catch (e) {
        reportError(e, { where: "lib/authorize/verifyGoogleToken#verifyGoogleIdToken" });
        return undefined;
    }
};
