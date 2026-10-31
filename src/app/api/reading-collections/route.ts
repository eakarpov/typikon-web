import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/authorize/sessions';
import { consume } from '@/lib/rateLimit';
import { editCollection, listCollections } from '@/lib/readingCollections/service';
import { CollectionError } from '@/lib/readingCollections/core';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';
export async function GET() { const s = await getSession(); if (!s)
    return new NextResponse(null, { status: 401 }); try {
    return NextResponse.json(await listCollections(s.id), { headers: { 'Cache-Control': 'private, no-store' } });
}
catch (e) {
    reportError(e, { where: 'collections#GET' });
    return NextResponse.json({ error: 'Не удалось загрузить подборки.' }, { status: 500 });
} }
export async function POST(req: NextRequest) {
    const s = await getSession();
    if (!s)
        return new NextResponse(null, { status: 401 });
    if (!consume(`collections:${s.id}`, 40, 60).allowed)
        return new NextResponse(null, { status: 429 });
    const b = await req.json().catch(() => null);
    if (!b || !['create', 'update', 'append', 'delete', 'publish', 'unpublish'].includes(b.action))
        return new NextResponse(null, { status: 400 });
    try {
        const id = await editCollection(s.id, b);
        return NextResponse.json({ id, collections: await listCollections(s.id) });
    }
    catch (e) {
        reportError(e, { where: 'collections#POST' });
        return NextResponse.json({ error: e instanceof CollectionError ? e.message : 'Не удалось изменить подборку.' }, { status: e instanceof CollectionError ? 409 : 500 });
    }
}
