import {csArticle,csOptions} from '@/lib/csDictionary/http';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:{id:string}}){return csArticle(request,params.id);}
export const OPTIONS=csOptions;
