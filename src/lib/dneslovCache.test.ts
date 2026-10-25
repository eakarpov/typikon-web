import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedDneslov, allDneslovPages, type SnapshotStore, type SuccessSnapshot } from './dneslovCache';
import { mergeDaySaints } from './daySaints/core';

function memoryStore(initial: SuccessSnapshot<any> | null = null) {
    let value = initial;
    let writes = 0;
    const store: SnapshotStore = {
        async read() { return value; },
        async write(_, data, fetchedAt) { value = { data, fetchedAt }; writes++; },
    };
    return { store, value: () => value, writes: () => writes };
}
test('полученный полный ответ сохраняется, свежий снимок не ходит к источнику', async () => {
    const s = memoryStore(); let calls = 0;
    const load = async () => { calls++; return [{ id: 1 }]; };
    const now = new Date('2026-10-25T00:00:00Z');
    assert.deepEqual((await cachedDneslov('fresh-test', 1000, load, s.store, now)).data, [{ id: 1 }]);
    await cachedDneslov('fresh-test', 1000, load, s.store, now);
    assert.equal(calls, 1); assert.equal(s.writes(), 1);
});
test('сбой не заменяет старый успешный ответ пустым и не мешает показать его', async () => {
    const old = { data: [{ id: 22 }], fetchedAt: new Date(0) };
    const s = memoryStore(old);
    const result = await cachedDneslov('stale-test', 1000, async () => { throw new Error('upstream down'); }, s.store);
    assert.deepEqual(result, { data: [{ id: 22 }], stale: true });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(s.value(), old); assert.equal(s.writes(), 0);
});
test('без снимка отказ источника не кэшируется как пустой день', async () => {
    const s = memoryStore();
    const result = await cachedDneslov('cold-test', 1000, async () => { throw new Error('down'); }, s.store);
    assert.equal(result.data, null); assert.equal(s.writes(), 0);
});
test('одновременные запросы к одному ключу объединяются', async () => {
    const s = memoryStore(); let calls = 0;
    let done!: (value: number[]) => void;
    const load = () => { calls++; return new Promise<number[]>(r => { done = r; }); };
    const a = cachedDneslov('coalesce-test', 1000, load, s.store);
    const b = cachedDneslov('coalesce-test', 1000, load, s.store);
    await Promise.resolve(); await Promise.resolve();
    done([1]); await Promise.all([a,b]); assert.equal(calls, 1);
});
test('пагинация забирает все страницы и сохраняет календарные параметры', async () => {
    const pages: string[] = [];
    const rows = await allDneslovPages('/index.json?d=ю12.10.2026&c=рпц,днес,стих', async path => {
        pages.push(path);
        const page = Number(new URL(path, 'https://dneslov.org').searchParams.get('page'));
        return { total: 3, list: page === 1 ? [{id:1},{id:2}] : [{id:3}] };
    });
    assert.equal(rows.length, 3); assert.equal(pages.length, 2);
    assert.equal(new URL(pages[1], 'https://dneslov.org').searchParams.get('c'), 'рпц,днес,стих');
});
test('оборванная пагинация отклоняется вместо сохранения урезанной коллекции', async () => {
    await assert.rejects(allDneslovPages('/index.json', async path => {
        const page = Number(new URL(path, 'https://dneslov.org').searchParams.get('page'));
        return { total: 3, list: page === 1 ? [{id:1}] : [] };
    }));
});
test('внешние памяти без ручной связки остаются, собственный каталог расширяет список', () => {
    const own = [{ _id:'own', slug:'our-saint', name:'Свой святой', externals: [] }];
    const rows = mergeDaySaints(own, [{id:10,title:'Первый'},{id:11,title:'Второй'}]);
    assert.deepEqual(rows.map(s=>s.name), ['Первый','Второй','Свой святой']);
    assert.deepEqual(rows.map(s=>s.slug), ['10','11','our-saint']);
});
test('выверенная запись имеет приоритет, два её номера не создают дубликаты', () => {
    const local = { _id:'same',slug:'manual',name:'Редакторское имя',externals:[{source:'dneslov',id:'10'},{source:'dneslov',id:'11'}] };
    const rows = mergeDaySaints([local], [{id:10,title:'Чужое имя'},{id:11,title:'Другое имя'},{id:12,title:'Новый'}]);
    assert.deepEqual(rows.map(s=>s.name), ['Редакторское имя','Новый']);
});
test('одинаковые имена разных лиц не сливаются', () => {
    const rows = mergeDaySaints([], [{id:1,title:'Иоанн'},{id:2,title:'Иоанн'}]);
    assert.equal(rows.length, 2);
});
