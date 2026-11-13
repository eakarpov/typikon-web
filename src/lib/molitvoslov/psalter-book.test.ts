import {test} from 'node:test';
import assert from 'node:assert/strict';
import {posledovanieTexts, POSLEDOVANIYA} from './store';
import {psalterCommemorationTexts} from '../pomyannik/psalter-names';
test('начальный и конечный чины доступны без установленной SQLite',()=>{
 for(const key of ['psaltir-before','psaltir-after']) {
  assert.equal(POSLEDOVANIYA[key],key);
  const book=posledovanieTexts(key,'cu','m');
  assert.equal(book?.lang,'cu_gr');assert.ok(book!.rows.length>=20);
  assert.ok(book!.rows.some(row=>row.repeatCount===3));
  assert.ok(book!.rows.some(row=>row.repeatCount===40));
 }
 const before=posledovanieTexts('psaltir-before','cu','m')!;
 assert.ok(before.rows.some(row=>row.text?.startsWith('Всесвята́я Тро́ице')));
 assert.ok(before.rows.at(-1)?.note?.startsWith('Таже постой'));
 const after=posledovanieTexts('psaltir-after','cu','m')!;
 assert.ok(after.rows.some(row=>row.text?.startsWith('Многоми́лостиве')));
 assert.ok(after.rows.at(-1)?.text?.includes('поми́луй и спаси́ мя'));
});
test('списки подставляются один раз; духовник и родители не получают весь список',()=>{
 const names={living:[{name:'Николая',commemorationSuffix:'children' as const}],departed:[{name:'Марии'}]};
 const prayers=psalterCommemorationTexts(names,'m',false,['living','departed']);
 assert.equal(prayers.length,2);
 for(const [i,name] of ['Николая','Марии'].entries()) {
  assert.equal(prayers[i].text.split(name).length-1,1);
  assert.deepEqual(prayers[i].italic,['роди́телей мои́х']);
 }
 assert.match(prayers[0].text,/духо́внаго \(имяре́к\), роди́телей/);
 assert.match(prayers[0].text,/рабо́в Твои́х Николая/);
 assert.ok(prayers[0].text.includes('со ч')); // приписка сохранена
 const third=psalterCommemorationTexts(names,'m',true,['living','departed']);
 assert.equal(third.length,1);assert.match(third[0].text,/^Помяни́/);
 assert.equal(third[0].text.split('Николая').length-1,1);
 assert.equal(third[0].text.split('Марии').length-1,1);
 assert.equal(psalterCommemorationTexts(names,'m',true,[]).length,0);
});
