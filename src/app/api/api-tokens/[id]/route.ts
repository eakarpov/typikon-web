import { NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { revokeToken } from "@/app/api/api-tokens/service";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });

    // Чужой ключ отозвать нельзя: владелец проверяется тем же запросом, что и правит.
    const revoked = await revokeToken(session.id, params.id);
    if (!revoked) return new NextResponse(null, { status: 404 });

    return NextResponse.json({ revoked: true });
}
