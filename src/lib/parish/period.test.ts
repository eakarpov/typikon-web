import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schedulePeriod,isoWeekKey,shiftSchedulePeriod,periodKeyForDate,periodsBetween,presentationDays,parishScheduleHref} from './period';
test('месяц по умолчанию и неделя имеют полный календарный диапазон',()=>{
    const month=schedulePeriod('2026-11')!,week=schedulePeriod('2026-W46')!;
    assert.equal(month.dates.length,30);assert.equal(month.start,'2026-11-01');assert.equal(month.end,'2026-11-30');
    assert.equal(week.dates.length,7);assert.equal(week.start,'2026-11-09');assert.equal(week.end,'2026-11-15');
    assert.equal(periodKeyForDate('2026-11-12','week'),'2026-W46');assert.equal(periodKeyForDate('2026-11-12','month'),'2026-11');
});
test('недели пересекают границы месяцев и лет, включая 53-ю неделю',()=>{
    assert.equal(isoWeekKey('2025-12-29'),'2026-W01');
    assert.equal(schedulePeriod('2026-W01')!.start,'2025-12-29');assert.equal(schedulePeriod('2026-W01')!.end,'2026-01-04');
    assert.equal(schedulePeriod('2026-W53')!.end,'2027-01-03');assert.equal(shiftSchedulePeriod('2026-W53',1),'2027-W01');
    assert.equal(shiftSchedulePeriod('2026-01',-1),'2025-12');
    for(const value of ['2025-W53','2026-W00','2026-W54','2026-13','invalid'])assert.equal(schedulePeriod(value),null);
});
test('подписной календарь использует выбранные приходом периоды без пропуска границ',()=>{
    assert.deepEqual(periodsBetween(new Date('2026-11-12'),new Date('2026-11-19'),'week'),['2026-W46','2026-W47']);
    assert.deepEqual(periodsBetween(new Date('2026-11-30'),new Date('2026-12-01'),'month'),['2026-11','2026-12']);
});
test('режим редактирования показывает правки, а публичный вид сохраняет опубликованный снимок',()=>{
    const live=[{time:'10:00'}],snapshot=[{time:'09:00'}];
    assert.equal(presentationDays(live,snapshot,true),live);assert.equal(presentationDays(live,snapshot,false),snapshot);
    assert.equal(presentationDays(live,undefined,false),live);
    assert.equal(parishScheduleHref('temple','2026-W46',true,true),'/parish/temple/schedule/2026-W46?edit=1&why=1');
});
