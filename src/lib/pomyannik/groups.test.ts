import { it } from 'node:test';
import assert from 'node:assert/strict';
import { groupIds, groupName, GroupError, selectedPersonIds } from './groups';
import { groupIdentity, planGroupMigration } from './groupMigration';
import { commemorationGroups, selectCommemorationPersons } from './commemoration';
import { makeBackup, parseBackup, planRestore } from './backup';
const a = 'a'.repeat(24), b = 'b'.repeat(24);
it('название группы не разбирается по запятым, ID принадлежит аккаунту и устойчив к нормализации названия', () => {
    assert.equal(groupName('  Родные,   друзья  '), 'Родные, друзья');
    assert.equal(groupIdentity('u', 'Крёстные'), groupIdentity('u', 'крестные'));
    assert.notEqual(groupIdentity('u', 'Семья'), groupIdentity('v', 'Семья'));
    for (const value of ['', null, {}, 'а'.repeat(41), 'a\0b'])
        assert.throws(() => groupName(value), GroupError);
});
it('API принимает ссылки, а не имена, и ограничивает состав одной записи', () => {
    assert.deepEqual(groupIds([a, a, b]), [a, b]);
    for (const value of [['Семья'], [a, 123], Array(11).fill(a)])
        assert.throws(() => groupIds(value), GroupError);
    assert.deepEqual(selectedPersonIds(Array.from({ length: 10000 }, (_, i) => i.toString(16).padStart(24, '0'))).length, 10000);
    for (const value of [[], [a, a], [a, 'foreign'], Array(10001).fill(a)])
        assert.throws(() => selectedPersonIds(value), GroupError);
});
it('миграция сохраняет состав, переносит настройки и закладку, не меняет входные документы', () => {
    const persons = [{ id: a, groups: ['Семья', 'семья', 'Друзья'] }, { id: b, groups: ['Друзья'] }];
    const settings = { commemorations: { 'psalter-1': { mode: 'group', group: 'Семья' }, 'morning-living': { mode: 'living' } }, readingPlace: { personId: a, group: 'Семья', kind: 'all' } };
    const before = JSON.stringify({ persons, settings }), plan = planGroupMigration('owner', persons, settings);
    assert.equal(plan.groups.length, 2);
    assert.deepEqual(plan.updates[0].groups, [groupIdentity('owner', 'Семья'), groupIdentity('owner', 'Друзья')]);
    assert.equal(plan.fields['commemorations.psalter-1.group'], plan.updates[0].groups[0]);
    assert.equal(plan.fields['readingPlace.group'], plan.updates[0].groups[0]);
    assert.equal(JSON.stringify({ persons, settings }), before);
    assert.equal('commemorations.morning-living' in plan.fields, false);
});
it('повторное применение плана не создаёт группы с именами-ID и не трогает перенесённые записи', () => {
    const first = planGroupMigration('u', [{ id: a, groups: ['Семья'] }], {});
    const repeat = planGroupMigration('u', [{ id: a, groups: first.updates[0].groups, groupsSchemaVersion: 1 }], { readingPlace: { group: first.groups[0].id } }, first.groups);
    assert.equal(repeat.groups.length, 1);
    assert.deepEqual(repeat.updates, []);
    assert.equal(repeat.fields['readingPlace.group'], first.groups[0].id);
});
it('пустая группа существует отдельно и не подменяется всем разделом при чтении', () => {
    const groups = [{ id: a, name: 'Пустая' }, { id: b, name: 'Семья' }];
    const persons: any[] = [{ id: '1', groups: [b], kind: 'living' }];
    assert.deepEqual(commemorationGroups(persons, groups), [{ id: a, name: 'Пустая', living: 0, departed: 0 }, { id: b, name: 'Семья', living: 1, departed: 0 }]);
    assert.deepEqual(selectCommemorationPersons(persons, 'psalter-1', { mode: 'group', group: a }), []);
});
it('копия переносит названия и пустые группы, а не связи чужого аккаунта', () => {
    const person: any = { name: 'Николай', kind: 'living', groups: [a], groupNames: ['Семья'] };
    const backup = parseBackup(makeBackup([person], new Date(), [{ name: 'Семья' }, { name: 'Пустая' }]));
    assert.deepEqual(backup.groups, ['Семья', 'Пустая']);
    assert.deepEqual(backup.persons[0].groups, ['Семья']);
    assert.equal(JSON.stringify(backup).includes(a), false);
    assert.equal(planRestore([person], backup.persons).additions.length, 0);
});
it('массовое добавление проверяет весь список владельца до записи и меняет только связи', async () => {
    const { addGroupMembers } = await import('./groupMembers');
    const operations: any[] = [];
    const original = { name: 'Николай', born: '1950', rank: 'ierey', signature: 'Иванов' };
    const store: any = { countDocuments: async (filter: any) => {
            operations.push(filter);
            return 1;
        }, updateMany: async () => {
            throw Error('Не должно быть записи');
        } };
    await assert.rejects(() => addGroupMembers(store, 'owner', a, [a, b]), GroupError);
    assert.equal(operations[0].userId, 'owner');
    assert.equal(operations[0].deletedAt, null);
    let patch: any;
    const valid: any = { countDocuments: async () => 2, updateMany: async (filter: any, update: any) => {
            assert.equal(filter.userId, 'owner');
            assert.equal(filter.deletedAt, null);
            assert.equal(filter.$expr.$lt[1], 10);
            patch = update;
            return { modifiedCount: 1 };
        }, find: (filter: any) => {
            assert.equal(filter.userId, 'owner');
            return { toArray: async () => [{ _id: a, groups: [a] }, { _id: b, groups: Array(10).fill(b) }] };
        } };
    const result = await addGroupMembers(valid, 'owner', a, [a, b]);
    assert.equal(result.added, 1);
    assert.deepEqual(result.skipped, [b]);
    assert.deepEqual(patch.$addToSet, { groups: a });
    for (const key of Object.keys(original))
        assert.equal(key in patch.$set, false);
});
