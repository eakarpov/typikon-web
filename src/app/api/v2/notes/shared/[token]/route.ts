import {sharedNote} from '@/lib/notes/sharing';
import {respondPrivate} from '@/lib/api/v2/http';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{token:string}>}){
  try{const note=await sharedNote((await params).token);return respondPrivate(note?{note}:{error:{code:'not_found',message:'Заметка не опубликована или доступ отключён.'}},{status:note?200:404});}
  catch{return respondPrivate({error:{code:'internal',message:'Заметка временно недоступна.'}},{status:503});}
}
