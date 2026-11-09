import {authorizeUser} from '@/lib/api/v2/user';
import {respondPrivate, fail, preflight} from '@/lib/api/v2/http';
import {listNotes, saveNote} from '@/lib/companion/notesService';
export const dynamic = 'force-dynamic';
export const OPTIONS = () => {const r = preflight(); r.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS'); return r;};
export async function GET(req: Request) {
  const a = await authorizeUser(req, 'texts'); if (a.denied) return a.denied;
  const q = new URL(req.url).searchParams, key = q.get('sessionKey'), node = q.get('nodeId');
  if (!key || !node || key.length > 512 || node.length > 512) return fail('bad_request','Укажите место службы.');
  try {return respondPrivate({userId: a.userId, notes: await listNotes(a.userId, key, node)}, {access: a});}
  catch {return fail('internal','Заметки временно недоступны.');}
}
export async function POST(req: Request) {
  const a = await authorizeUser(req, 'texts'); if (a.denied) return a.denied;
  try {
    const text = await req.text(); if (text.length > 70000) return fail('bad_request','Слишком большой запрос.');
    const b = JSON.parse(text);
    if (!b || typeof b !== 'object' || Array.isArray(b)) return fail('bad_request','Неверная заметка.');
    if (b.expectedUserId !== a.userId) return fail('conflict','Вход изменился. Откройте Спутник заново.');
    return respondPrivate({userId: a.userId, note: await saveNote(a.userId, b)}, {access: a});
  } catch (e) {
    if ((e as Error).message === 'conflict') return fail('conflict','Заметка изменена на другом устройстве. Обновите список; ваш текст сохранён в редакторе.');
    if (e instanceof SyntaxError || /^(Неверн|Выберите|Укажите)/.test((e as Error).message)) return fail('bad_request','Неверная заметка.');
    return fail('internal','Не удалось сохранить заметку. Текст остаётся в редакторе.');
  }
}
