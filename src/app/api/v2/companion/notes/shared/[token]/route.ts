import {readSharedNote} from '@/lib/companion/notesService';
import {respondPrivate} from '@/lib/api/v2/http';
export const dynamic = 'force-dynamic';
// Sharing is deliberate public access; no account or corpus API key is needed.
export async function GET(_req: Request, {params}: {params: Promise<{token: string}>}) {
  try {
    const note = await readSharedNote((await params).token);
    return respondPrivate(note ? {note} : {error:{code:'not_found',message:'Заметка не опубликована или доступ отключён.'}}, {status: note ? 200 : 404});
  } catch {return respondPrivate({error:{code:'internal',message:'Заметка временно недоступна.'}}, {status:503});}
}
