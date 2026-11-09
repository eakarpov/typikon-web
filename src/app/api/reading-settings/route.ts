import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { sanitizeReadingValues } from "@/lib/settings/account";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Войдите в учётную запись" }, { status: 401, headers });
    const db = (await clientPromise).db("typikon-users");
    const user = await db.collection("users").findOne({ _id: new ObjectId(session.id) }, { projection: { readingSettings: 1 } });
    return NextResponse.json({ values: user?.readingSettings ? sanitizeReadingValues(user.readingSettings) : null }, { headers });
}

export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Войдите в учётную запись" }, { status: 401, headers });
    const body = await request.json().catch(() => null);
    if (!body?.values || typeof body.values !== "object" || Array.isArray(body.values)) return NextResponse.json({ error: "Неверные настройки" }, { status: 400, headers });
    const values = sanitizeReadingValues(body.values);
    const db = (await clientPromise).db("typikon-users");
    const result = await db.collection("users").updateOne({ _id: new ObjectId(session.id) }, { $set: { readingSettings: values } });
    if (!result.matchedCount) return NextResponse.json({ error: "Учётная запись не найдена" }, { status: 404, headers });
    return NextResponse.json({ values }, { headers });
}
