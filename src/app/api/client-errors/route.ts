import {NextRequest, NextResponse} from "next/server";
import {reportError} from "@/lib/reportError";

// Принимает ошибки, случившиеся в браузере. До этого они не доезжали никуда:
// на сервере их не видно, а пользователь просто видел сломанную страницу.
export const dynamic = "force-dynamic";

// Своя защита от потока: ручка публичная и пишет в лог.
const seen = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 10;
const WINDOW_MS = 60_000;

const allowed = (ip: string) => {
    const now = Date.now();
    const bucket = seen.get(ip);

    if (!bucket || bucket.resetAt <= now) {
        seen.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        if (seen.size > 1000) {
            for (const [key, value] of seen) if (value.resetAt <= now) seen.delete(key);
        }
        return true;
    }

    bucket.count++;
    return bucket.count <= LIMIT;
};

export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (!allowed(ip)) {
        return new NextResponse(null, { status: 429 });
    }

    const body = await request.json().catch(() => null);

    if (!body?.message) {
        return new NextResponse(null, { status: 400 });
    }

    // Собираем настоящий Error, чтобы name/message/stack легли в лог отдельными
    // полями, а не вложенным JSON внутри message.
    const clientError = new Error(String(body.message).slice(0, 500));
    clientError.name = String(body.name ?? "ClientError").slice(0, 100);
    clientError.stack = String(body.stack ?? "").slice(0, 4000);

    reportError(
        clientError,
        {
            source: "client",
            where: String(body.where ?? "unknown").slice(0, 200),
            extra: {
                digest: body.digest ? String(body.digest).slice(0, 100) : undefined,
                userAgent: request.headers.get("user-agent")?.slice(0, 200),
            },
        },
    );

    return new NextResponse(null, { status: 204 });
}
