import { authorize } from '@/lib/api/v2/access';
import { fail,preflight,respond } from '@/lib/api/v2/http';
import { rulesDb } from '@/lib/rulesDb';
import { saintService } from '@/lib/saintWorks';
import { reportError } from '@/lib/reportError';
export const dynamic='force-dynamic';
export async function OPTIONS(){return preflight();}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
    const access=await authorize(request,'texts');
    if(access.denied)return access.denied;
    try {
        const {id}=await params;
        const db=rulesDb();
        if(!db)return fail('corpus_unavailable','Певческий корпус временно недоступен');
        const language=new URL(request.url).searchParams.get('lang');
        const data=saintService(db,id,language);
        if(!data)return fail('not_found','Служба этой памяти не найдена');
        return respond(data,{access,maxAge:3600});
    } catch(e){reportError(e,{where:'api/v2/saints/service'});return fail('internal','Не удалось открыть службу памяти');}
}
