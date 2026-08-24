import { preflight, respond } from "@/lib/api/v2/http";
import { openapi } from "@/lib/api/v2/openapi";

// Машинное описание API: по нему генерируются клиенты и строится документация.
export const revalidate = 86400;

export async function OPTIONS() {
    return preflight();
}

export async function GET() {
    return respond(openapi(), { maxAge: 86400 });
}
