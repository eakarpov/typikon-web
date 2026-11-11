import {csMorphemes,csOptions} from '@/lib/csDictionary/morphemeHttp';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:{id:string}}){return csMorphemes(request,params.id,'words');}
export const OPTIONS=csOptions;
