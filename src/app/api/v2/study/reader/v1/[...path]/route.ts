import { handleIndex } from '@/lib/reader/index/http';
import { handle, options } from '@/lib/reader/http';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const OPTIONS=options;
async function dispatch(request:Request,context:{params:{path:string[]}}){const parts=(await context.params).path;if(parts.length===2&&parts[0]==='index')return handleIndex(request,parts[1]);if(parts.length===1)return handle(request,parts[0]);if(parts.length===2&&parts[0]==='passport')return handle(request,'passport',parts[1]);return handle(request,'not-found');}
export const GET=dispatch;
export const POST=dispatch;
