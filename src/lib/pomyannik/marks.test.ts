import { it } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveRanks, effectiveMark, statusRank, temporaryRank } from './marks';
import { snapshot } from './note';
import { joinNames } from '../molitvoslov/named';
import { makeBackup, parseBackup, planRestore } from './backup';
it('old temporary rank is a mark and survives serialization', () => {
    const p = { rank: 'bolyashchiy' as const, rankUntil: '2099-01-01' };
    assert.equal(statusRank(p), null);
    assert.equal(temporaryRank(p), 'bolyashchiy');
    assert.deepEqual(effectiveRanks(p, '2026-11-12'), ['bolyashchiy']);
});
it('two independent categories expire separately', () => {
    const p = { rank: 'ierey' as const, mark: 'bolyashchiy' as const, rankUntil: '2026-11-12' };
    assert.deepEqual(effectiveRanks(p, '2026-11-12'), ['ierey', 'bolyashchiy']);
    assert.deepEqual(effectiveRanks(p, '2026-11-13'), ['ierey']);
    assert.equal(p.mark, 'bolyashchiy');
});
it('a newly departed priest retains his status through the fortieth day', () => {
    const p = { rank: 'ierey' as const, kind: 'departed', died: '2026-11-01' };
    assert.deepEqual(effectiveRanks(p, '2026-12-10'), ['ierey', 'novoprestavlennyy']);
    assert.deepEqual(effectiveRanks(p, '2026-12-11'), ['ierey']);
    assert.equal(effectiveMark({ ...p, died: '--11-01' }, '2026-11-12'), null);
});
it('explicitly cleared legacy mark does not reappear', () => assert.deepEqual(effectiveRanks({ rank: 'bolyashchiy', mark: null }, '2026-11-12'), []));
it('prayer and note preserve both categories, private signature never enters the note', () => {
    const p = { name: 'Иоанн', kind: 'living' as const, rank: 'ierey' as const, mark: 'bolyashchiy' as const, signature: 'Иванов' };
    const saved = snapshot(p);
    assert.deepEqual(saved.marks, ['ierey', 'bolyashchiy']);
    assert.equal('signature' in saved, false);
    const text = joinNames([{ name: 'їѡа́нна', marks: saved.marks, sex: 'm' }], 'm');
    assert.match(text, /і҆ере́ѧ болящего Їѡа́нна/);
});
it('backup preserves both categories and deadline without duplicates on repeated restore', () => {
    const p: any = { name: 'Иоанн', kind: 'living', rank: 'ierey', mark: 'bolyashchiy', rankUntil: '2099-01-01', groups: [] };
    const backup = parseBackup(makeBackup([p]));
    assert.equal(backup.persons[0].mark, 'bolyashchiy');
    assert.equal(planRestore([p], backup.persons).additions.length, 0);
});
it('old and new representation identify the same person during restore', () => {
    const old: any = { name: 'Николай', kind: 'living', rank: 'bolyashchiy', rankUntil: '2099-01-01', groups: [] };
    const modern = { ...old, rank: null, mark: 'bolyashchiy' };
    assert.equal(planRestore([modern], makeBackup([old]).persons).additions.length, 0);
    assert.equal(planRestore([old], makeBackup([modern]).persons).additions.length, 0);
});
