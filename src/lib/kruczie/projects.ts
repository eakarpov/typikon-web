import { decodeWorkDraft, encodeWorkDraft, WORK_DRAFT_KEY, type SavedWorkDraft } from './workDraft';
export const PROJECT_PREFIX = 'kruczie.project.v1.';
const MIGRATED = 'kruczie.projects-legacy-migrated.v1';
export interface ChantProject {
    format: 'typikon-chant-project';
    version: 1;
    id: string;
    title: string;
    updatedAt: string;
    draft: string;
}
const storage = () => localStorage;
function projectTitle(value: string) { const title = value.trim(); if (!title || title.length > 120)
    throw Error('Название проекта: от 1 до 120 символов.'); return title; }
function key(id: string) { if (!/^[a-f0-9-]{36}$/.test(id))
    throw Error('Некорректный проект.'); return PROJECT_PREFIX + id; }
export function readProject(id: string, store: Storage = storage()): ChantProject { const raw = store.getItem(key(id)); if (!raw)
    throw Error('Проект не найден в этом браузере.'); const p = JSON.parse(raw); if (p.format !== 'typikon-chant-project' || p.version !== 1 || p.id !== id || typeof p.draft !== 'string' || typeof p.title !== 'string')
    throw Error('Сохранение проекта повреждено.'); return p; }
export function listProjects(store: Storage = storage()): ChantProject[] { const rows: ChantProject[] = []; for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith(PROJECT_PREFIX))
        rows.push(readProject(k.slice(PROJECT_PREFIX.length), store));
} return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
export function createProject(title: string, draft: SavedWorkDraft, store: Storage = storage()): ChantProject { if (listProjects(store).length >= 50)
    throw Error('В этом браузере уже 50 проектов. Скачайте архив нужного проекта перед удалением.'); const p: ChantProject = { format: 'typikon-chant-project', version: 1, id: crypto.randomUUID(), title: projectTitle(title), updatedAt: new Date().toISOString(), draft: encodeWorkDraft(draft) }; store.setItem(key(p.id), JSON.stringify(p)); return p; }
export function saveProjectDraft(id: string, draft: SavedWorkDraft, store: Storage = storage()) { const p = readProject(id, store); store.setItem(key(id), JSON.stringify({ ...p, updatedAt: new Date().toISOString(), draft: encodeWorkDraft(draft) })); }
export function renameProject(id: string, title: string, store: Storage = storage()) { const p = readProject(id, store); store.setItem(key(id), JSON.stringify({ ...p, title: projectTitle(title), updatedAt: new Date().toISOString() })); }
export function removeProject(id: string, store: Storage = storage()) { store.removeItem(key(id)); }
export function exportProject(id: string, store: Storage = storage()) { const { id: omit, ...p } = readProject(id, store); return JSON.stringify(p, null, 2); }
export async function importProject(raw: string, store: Storage = storage()) { if (raw.length > 2200000)
    throw Error('Файл проекта слишком большой.'); const p = JSON.parse(raw); if (p?.format !== 'typikon-chant-project' || p.version !== 1 || typeof p.title !== 'string' || typeof p.draft !== 'string')
    throw Error('Неподдерживаемый файл проекта.'); const draft = await decodeWorkDraft(p.draft); return createProject(p.title, draft, store); }
export async function copyProject(id: string, store: Storage = storage()) { const p = readProject(id, store); return createProject(p.title.slice(0, 110) + ' — копия', await decodeWorkDraft(p.draft), store); }
export async function migrateLegacyProject(store: Storage = storage()) { if (store.getItem(MIGRATED))
    return; const raw = store.getItem(WORK_DRAFT_KEY); if (raw)
    createProject('Восстановленный разбор', await decodeWorkDraft(raw), store); store.setItem(MIGRATED, '1'); }
