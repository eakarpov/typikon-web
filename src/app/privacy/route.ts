// Явный HTTP-ответ сохраняет Location и при обращении без JavaScript.
// Политика одна для сайта и мобильного приложения.
export const dynamic = "force-dynamic";

export function GET() {
    return new Response(null, {
        status: 307,
        headers: {
            Location: "/privacy-policy.pdf",
            "Cache-Control": "no-store",
        },
    });
}

export const HEAD = GET;
