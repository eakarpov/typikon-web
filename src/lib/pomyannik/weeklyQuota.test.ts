import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WEEKLY_POLICY, parseWeeklyPolicy, weeklyWindow } from './weeklyQuota';
test('weekly boundary is Sunday 15:00 Moscow, inclusive, across year boundaries', () => {
    for (const [at, start, end] of [
        ['2026-11-15T11:59:59.999Z','2026-11-08T12:00:00.000Z','2026-11-15T12:00:00.000Z'],
        ['2026-11-15T12:00:00.000Z','2026-11-15T12:00:00.000Z','2026-11-22T12:00:00.000Z'],
        ['2027-01-01T12:00:00.000Z','2026-12-27T12:00:00.000Z','2027-01-03T12:00:00.000Z'],
    ]) {
        const window = weeklyWindow(DEFAULT_WEEKLY_POLICY, new Date(at));
        assert.equal(window.start.toISOString(),start); assert.equal(window.end.toISOString(),end);
    }
});
test('custom weekday, hour and minute and policy validation', () => {
    const policy = parseWeeklyPolicy({namesLimit:30,resetDay:1,resetHour:0,resetMinute:30});
    assert.equal(weeklyWindow(policy,new Date('2026-11-15T21:30:00Z')).start.toISOString(),'2026-11-15T21:30:00.000Z');
    for (const patch of [{namesLimit:0},{namesLimit:1.5},{resetDay:0},{resetDay:8},{resetHour:24},{resetMinute:60}])
        assert.throws(()=>parseWeeklyPolicy({...policy,...patch}));
});
