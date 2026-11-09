import {validateSelection, type Selection} from './core';

export interface PersonalNote {
  id: string; userId: string; sessionKey: string; nodeId: string;
  contentHash: string; title: string; nodeTitle: string; selection: Selection;
  text: string; sharingRevision?: number; revision: number; shareToken: string | null; updatedAt: string;
}
export function validateNote(raw: unknown) {
  const b = raw as Record<string, unknown>;
  const str = (key: string, max: number) => {
    const v = b?.[key];
    if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error('Неверная заметка.');
    return v.trim();
  };
  const id = str('id', 80);
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id) || !Number.isSafeInteger(b.expectedRevision) || Number(b.expectedRevision) < 0 || typeof b.published !== 'boolean') throw Error('Неверная версия заметки.');
  return {id, sessionKey: str('sessionKey', 512), nodeId: str('nodeId', 512), contentHash: str('contentHash', 256), title: str('title', 300), nodeTitle: str('nodeTitle', 300), selection: validateSelection(b.selection), text: str('text', 10000), expectedRevision: Number(b.expectedRevision), expectedSharingRevision: typeof b.expectedSharingRevision === "number" && Number.isSafeInteger(b.expectedSharingRevision) && b.expectedSharingRevision >= 0 ? b.expectedSharingRevision : 0, published: b.published};
}
export function publicNote(n: PersonalNote) {
  // Deliberate allowlist: neither owner, private IDs nor session state is public.
  return {title: n.title, nodeTitle: n.nodeTitle, nodeId: n.nodeId, contentHash: n.contentHash, selection: n.selection, text: n.text, updatedAt: n.updatedAt};
}
export function ownNote(n: PersonalNote) {
  const {userId: _owner, ...rest} = n;
  return {...rest, published: !!n.shareToken};
}
