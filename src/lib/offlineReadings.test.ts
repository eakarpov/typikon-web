import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offlineDays } from './offlineReadings';
test('range is inclusive, crosses month and leap day', () => { assert.deepEqual(offlineDays('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29', '2028-03-01']); });
test('reject reversed, normalized, oversized and malformed ranges', () => { for (const [a, b] of [['2026-02-30', '2026-03-01'], ['2026-03-02', '2026-03-01'], ['2026-01-01', '2026-02-01'], [null, {}]])
    assert.equal(offlineDays(a, b), null); assert.equal(offlineDays('2026-01-01', '2026-01-31')?.length, 31); });
