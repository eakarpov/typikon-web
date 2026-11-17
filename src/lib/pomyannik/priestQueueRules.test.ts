import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fits, parseSettings, rankSlots, reminderDue, usedNames, type ServiceSlot } from './priestQueueRules';
const now = new Date('2026-11-15T08:00:00Z');
const slot = (patch: Partial<ServiceSlot> = {}): ServiceSlot => ({ _id: 'a', userId: 'priest',
    kind: 'proskomidia', enabled: true, namesLimit: 30, startsAt: new Date(+now + 3600000),
    timeZone: 'Europe/Moscow', reminderEnabled: true, active: true, readyAt: now,
    entries: [], revision: 0, ...patch });
test('limits count every name, including already read notes', () => {
    const s = slot({ entries: [{ noteId: 'n', namesCount: 28, readAt: now, extra: false }] });
    assert.equal(usedNames(s), 28);
    assert.equal(fits(s, 3, now), false);
    assert.equal(fits(s, 2, now), true);
});
test('disabled, delayed and started services cannot automatically receive notes', () => {
    for (const patch of [{ enabled: false }, { readyAt: new Date(+now + 1) }, { startsAt: now }])
        assert.equal(fits(slot(patch), 1, now), false);
});
test('earliest date, normalized load, and last assignment determine distribution', () => {
    const busy = slot({ _id: 'busy', namesLimit: 60,
        entries: [{ noteId: 'n', namesCount: 20, readAt: null, extra: false }] });
    const idle = slot({ _id: 'idle' });
    assert.equal(rankSlots([busy, idle])[0]._id, 'idle');
    assert.equal(rankSlots([slot({ _id: 'later', startsAt: new Date(+now + 7200000) }), busy])[0]._id, 'busy');
});
test('reminder is conditional on unread entries, time window, and enablement', () => {
    const s = slot({ entries: [{ noteId: 'n', namesCount: 2, readAt: null, extra: false }] });
    assert.equal(reminderDue(s, now), true);
    for (const patch of [{ reminderEnabled: false }, { reminderSentAt: now },
        { startsAt: now }, { startsAt: new Date(+now + 3600001) }, { entries: [] }])
        assert.equal(reminderDue(slot({ ...s, ...patch }), now), false);
});
test('settings reject malformed quota, zone, missing/future dates and unknown service', () => {
    const input = { kind: 'proskomidia', enabled: true, reminderEnabled: false,
        namesLimit: 30, timeZone: 'Europe/Moscow', startsAt: new Date(+now + 600000).toISOString() };
    assert.equal(parseSettings(input, now).namesLimit, 30);
    for (const patch of [{ namesLimit: 0 }, { namesLimit: 2.5 }, { timeZone: 'MSKK' },
        { startsAt: null }, { startsAt: now.toISOString() }, { kind: 'sorokoust' }])
        assert.throws(() => parseSettings({ ...input, ...patch }, now));
});
test('small remaining capacity never splits a note', () => {
    const s = slot({ entries: [{ noteId: 'large', namesCount: 27, extra: false, readAt: null }] });
    assert.equal(fits(s, 5, now), false);
});
