import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advancePlan, validDate, type ReadingPlan } from './core';
import { selectedStatia } from '../readingParts';
const plan: ReadingPlan = { id: 'p', revision: 3, kind: 'lectionary', title: 'Ряд', status: 'active', cursor: 0, date: '2026-12-31', units: [] };
test('row only advances by explicit mark, then crosses year without skipped readings', () => { const a = advancePlan(plan, 2); assert.equal(a.date, plan.date); assert.equal(a.cursor, 1); assert.equal(a.revision, 4); const b = advancePlan(a, 2); assert.equal(b.date, '2027-01-01'); assert.equal(b.cursor, 0); });
test('paused and completed plans cannot advance', () => { for (const status of ['paused', 'completed'] as const)
    assert.throws(() => advancePlan({ ...plan, status }, 2)); });
test('book ends at final unit; empty calendar day can be advanced explicitly', () => { assert.equal(advancePlan({ ...plan, kind: 'book' }, 1).status, 'completed'); assert.equal(advancePlan(plan, 0).date, '2027-01-01'); });
test('date rejects normalization and injection', () => { assert.equal(validDate('2026-02-30'), false); assert.equal(validDate({ $gt: '' }), false); assert.equal(validDate('2100-01-01'), false); assert.equal(validDate('2028-02-29'), true); });
test('only corpus statia boundaries are selected', () => { assert.equal(selectedStatia('Первое[Статия 2]Второе', '2')?.content, 'Второе'); assert.equal(selectedStatia('Первое', '2'), null); assert.equal(selectedStatia('Первое', ['1']), null); assert.equal(selectedStatia('Первое', '0'), null); });
