import { authorize } from '@/lib/api/v2/access';
import { respond,fail,preflight } from '@/lib/api/v2/http';
import { getCatalog } from '@/lib/prayerCircle/assembly';
export const dynamic='force-dynamic';
export const OPTIONS=()=>preflight();
export async function GET(req:Request) {
    const a=await authorize(req,'texts');if(a.denied)return a.denied;
    try{return respond(await getCatalog(),{access:a,maxAge:300});}
    catch{return fail('corpus_unavailable','Каталог последований недоступен.');}
}
