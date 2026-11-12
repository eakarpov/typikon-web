import { createHash } from 'node:crypto';
import { groupKey, groupName } from './groups';
export const groupIdentity = (userId: string, name: string) => createHash('sha256').update(`${userId}\0${groupKey(name)}`).digest('hex').slice(0, 24);
interface OldPerson {
    id: string;
    groups?: string[];
    groupsSchemaVersion?: number;
}
interface StoredGroup {
    id: string;
    name: string;
    key: string;
}
/** План не меняет входные данные. В коллекции связи обновляются условием по прежнему значению. */
export function planGroupMigration(userId: string, persons: OldPerson[], settings: {
    commemorations?: Record<string, any>;
    readingPlace?: any;
}, existing: StoredGroup[] = []) {
    const byId = new Map(existing.map(g => [g.id, g])), byKey = new Map(existing.map(g => [g.key, g]));
    const resolve = (raw: string) => {
        if (byId.has(raw))
            return raw;
        const name = groupName(raw), key = groupKey(name), found = byKey.get(key);
        if (found)
            return found.id;
        const group = { id: groupIdentity(userId, name), name, key };
        byKey.set(key, group);
        byId.set(group.id, group);
        return group.id;
    };
    const updates = persons.filter(p => p.groupsSchemaVersion !== 1).map(p => ({ id: p.id, previous: p.groups, groups: [...new Set((p.groups ?? []).map(resolve))] }));
    const fields: Record<string, unknown> = { groupsVersion: 1 };
    for (const [place, choice] of Object.entries(settings.commemorations ?? {}))
        if (choice.mode === 'group' && choice.group)
            fields[`commemorations.${place}.group`] = resolve(choice.group);
    if (settings.readingPlace?.group)
        fields['readingPlace.group'] = resolve(settings.readingPlace.group);
    return { groups: [...byId.values()], updates, fields };
}
