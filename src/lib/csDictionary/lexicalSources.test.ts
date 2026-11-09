import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceEntry} from './dsl';

function fragments(code:string,raw:string){
 return sourceEntry('source','entry',code,'Словарь','v',raw).anchors.filter(a=>a.translation!==null);
}
test('добрый gets equivalents from orthodic and Гильтебрандт without Scripture examples',()=>{
 const orthodic=fragments('od',' прекрасный, хороший, настоящий, годный, 2. красивый');
 assert.deepEqual(orthodic.map(a=>a.translation),['прекрасный; хороший; настоящий; годный','красивый']);
 const raw=' ‹До́бръ›, ‹-а̀›, ‹-о› (‹До́брый›, ‹-аѧ›, ‹-ое›) (καλός, ἀγαθός, bonus) – добрый, рачительный, хороший. Мф 3:10є҆́же не твори́тъ плода̀ добра̀.';
 const result=fragments('ГлтНЗ',raw);
 assert.equal(result.length,1);
 assert.equal(result[0].translation,'добрый; рачительный; хороший');
 assert.equal(result[0].text,'добрый, рачительный, хороший');
 assert.equal(result[0].status,'source-fragment');
 assert.equal(result[0].sourceId,'source');
 assert.equal(result[0].sourceVersion,'v');
 assert.ok(raw.includes(result[0].text));
});
test('phrase headings, references and running explanations do not become equivalent lists',()=>{
 for(const raw of [' ‹Добрые люди› свидетели, известные честностью и прямотой','см. благой','место, которое находится у реки','пример (Мф. 3, 10)'])assert.deepEqual(fragments('od',raw),[]);
 assert.deepEqual(fragments('ГлтНЗ','Добрый человек – человек из примера (Мф. 3, 10).'),[]);
 assert.deepEqual(fragments('ГлтНЗ','(καλός) – см. благой.'),[]);
});
test('new equivalent fragments retain stable IDs and leave the unsegmented source intact',()=>{
 const raw='(καλός) – добрый, хороший. Мф 3:10 пример.';
 const source=sourceEntry('source','entry','ГлтНЗ','Словарь','v',raw);
 assert.equal(source.anchors[0].translation,null);
 assert.equal(source.anchors[0].text,raw);
 assert.equal(fragments('ГлтНЗ',raw)[0].id,sourceEntry('source','entry','ГлтНЗ','Словарь','v2',raw).anchors[1].id);
});
