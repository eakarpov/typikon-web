import { MAX_PERSONS } from './types';
export interface PomyannikGroup {
    id: string;
    name: string;
}
export class GroupError extends Error {
}
export const groupKey = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('ru').replace(/ё/g, 'е');
export function groupName(raw: unknown): string {
    if (typeof raw !== 'string' || /[\u0000-\u001f]/.test(raw))
        throw new GroupError('Укажите название группы.');
    const name = raw.replace(/\s+/g, ' ').trim();
    if (!name || name.length > 40)
        throw new GroupError('Название группы должно содержать от 1 до 40 символов.');
    return name;
}
export function groupIds(raw: unknown): string[] {
    if (raw == null)
        return [];
    if (!Array.isArray(raw) || raw.length > 10 || raw.some(id => typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)))
        throw new GroupError('Выберите не более десяти групп из списка.');
    return [...new Set(raw)];
}
export function selectedPersonIds(raw: unknown): string[] {
    if (!Array.isArray(raw) || !raw.length || raw.length > MAX_PERSONS || raw.some(id => typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)) || new Set(raw).size !== raw.length)
        throw new GroupError('Выберите записи для добавления в группу.');
    return raw;
}
