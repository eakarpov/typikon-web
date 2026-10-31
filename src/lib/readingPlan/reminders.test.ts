import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duePlanReminder, parsePlanReminder, type PlanReminder } from './reminders';
const reminder: PlanReminder = { enabled: true, time: '08:15', weekdays: [1, 3, 5], timeZone: 'Europe/Moscow' };
test('schedule validates time, weekdays and IANA zone; ignores client version', () => { assert.deepEqual(parsePlanReminder({ ...reminder, weekdays: [5, 1, 1], version: 'injected' }), { ...reminder, weekdays: [1, 5] }); for (const r of [{ ...reminder, time: '24:00' }, { ...reminder, time: '8:15' }, { ...reminder, weekdays: [] }, { ...reminder, weekdays: [0] }, { ...reminder, timeZone: 'Mars/Olympus' }, null])
    assert.equal(parsePlanReminder(r), null); });
test('local date and weekday, exact minute and limited catch-up window', () => { const plan = { status: 'active', reminder }; assert.equal(duePlanReminder(plan, new Date('2026-11-02T05:14:00Z')), null); assert.equal(duePlanReminder(plan, new Date('2026-11-02T05:15:00Z')), '2026-11-02'); assert.equal(duePlanReminder(plan, new Date('2026-11-02T06:15:00Z')), null); assert.equal(duePlanReminder(plan, new Date('2026-11-03T05:15:00Z')), null); });
test('pause, completion and disabled settings suppress delivery', () => { for (const status of ['paused', 'completed'])
    assert.equal(duePlanReminder({ status, reminder }, new Date('2026-11-02T05:15:00Z')), null); assert.equal(duePlanReminder({ status: 'active', reminder: { ...reminder, enabled: false } }, new Date('2026-11-02T05:15:00Z')), null); });
test('date follows selected zone across UTC midnight and repeated DST hour shares one date', () => { const r = { ...reminder, time: '00:15', weekdays: [1], timeZone: 'Asia/Kamchatka' }; assert.equal(duePlanReminder({ status: 'active', reminder: r }, new Date('2026-11-01T12:15:00Z')), '2026-11-02'); const dst = { ...r, time: '01:30', weekdays: [7], timeZone: 'America/New_York' }; for (const time of ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'])
    assert.equal(duePlanReminder({ status: 'active', reminder: dst }, new Date(time)), '2026-11-01'); });
