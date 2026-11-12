import { listGroups } from "@/lib/pomyannik/groupsService";
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/authorize/sessions';
import { getBookSettings, listPersons, setCommemorations } from '@/lib/pomyannik/service';
import { CommemorationError, commemorationGroups } from '@/lib/pomyannik/commemoration';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control':'private, no-store' };
export async function GET() {
    const session = await getSession(); if (!session) return new NextResponse(null,{status:401,headers});
    const [settings,persons] = await Promise.all([getBookSettings(session.id),listPersons(session.id)]);
    return NextResponse.json({ settings:settings.commemorations, groups:commemorationGroups(persons,await listGroups(session.id)) },{headers});
}
export async function PUT(request:NextRequest) {
    const session = await getSession(); if (!session) return new NextResponse(null,{status:401,headers});
    const body = await request.json().catch(()=>null);
    try { return NextResponse.json({settings:await setCommemorations(session.id,body?.settings)},{headers}); }
    catch(e) { if(e instanceof CommemorationError) return NextResponse.json({error:e.message},{status:400,headers}); throw e; }
}
