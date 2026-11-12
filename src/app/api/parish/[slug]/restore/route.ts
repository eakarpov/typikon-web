import {NextResponse} from 'next/server';
import {rightsOn,touchAdmin} from '@/lib/parish/access';
import {restoreGathering} from '@/lib/parish/edits';
import {schedulePeriod} from '@/lib/parish/period';
export async function POST(request:Request,ctx:{params:Promise<{slug:string}>}){
 const {slug}=await ctx.params,rights=await rightsOn(slug);
 if(!rights.canEdit)return NextResponse.json({error:rights.userId?'Этот храм ведёте не вы':'Войдите'},{status:rights.userId?403:401});
 const body=await request.json().catch(()=>null);
 if(typeof body?.period!=='string'||typeof body?.date!=='string'||!schedulePeriod(body.period)?.dates.includes(body.date)||typeof body?.gatheringKey!=='string'||!body.gatheringKey||body.gatheringKey.length>1000)return NextResponse.json({error:'Укажите богослужение и дату в выбранном периоде'},{status:400});
 await restoreGathering(slug,body.date,body.gatheringKey);
 await touchAdmin(slug,rights.userId!);
 return NextResponse.json({ok:true});
}
