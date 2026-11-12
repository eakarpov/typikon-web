import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCommemorations,readCommemorations,validateCommemorations,selectCommemorationPersons,commemorationGroups } from './commemoration';
import type { PomyannikPerson } from './types';
const person=(id:string,kind:'living'|'departed',groups:string[]=[],extra:Partial<PomyannikPerson>={}):PomyannikPerson=>({
    id,userId:'owner',name:'Николай',nameKey:'николай',churchName:null,kind,sex:'m',rank:null,relation:null,
    born:null,baptized:null,died:null,nameDay:null,sorokoust:null,groups,order:0,createdAt:new Date(),updatedAt:new Date(),...extra,
});
const persons=[person('a','living',['Семья']),person('b','departed',['Семья']),person('c','living',['Друзья']),person('d','departed',['Род']),person('e','living',['Семья'],{deletedAt:new Date()})];
describe('поминовение в молитвенных чтениях',()=>{
    it('без новых настроек использует три заданных значения Псалтири и два утренних',()=>{
        assert.deepEqual(readCommemorations(undefined),defaultCommemorations());
        assert.deepEqual(Object.values(defaultCommemorations()).map(c=>c.mode),['living','departed','none','living','departed']);
    });
    it('изменение одного места не меняет остальные и не возвращает изменяемые общие объекты',()=>{
        const patch=validateCommemorations({'psalter-3':{mode:'group',group:'Семья',for:'living'}});
        const settings=readCommemorations(patch);
        assert.equal(settings['psalter-1'].mode,'living');assert.equal(settings['psalter-2'].mode,'departed');
        assert.deepEqual(settings['psalter-3'],{mode:'group',group:'Семья',for:'living'});
        settings['psalter-1'].mode='none';assert.equal(defaultCommemorations()['psalter-1'].mode,'living');
    });
    it('на каждой славе выбирает свой раздел или группу, не добавляет корзину',()=>{
        assert.deepEqual(selectCommemorationPersons(persons,'psalter-1',{mode:'living'}).map(p=>p.id),['a','c']);
        assert.deepEqual(selectCommemorationPersons(persons,'psalter-2',{mode:'departed'}).map(p=>p.id),['b','d']);
        assert.deepEqual(selectCommemorationPersons(persons,'psalter-3',{mode:'none'}),[]);
        assert.deepEqual(selectCommemorationPersons(persons,'psalter-3',{mode:'group',group:'Семья'}).map(p=>p.id),['a','b']);
        assert.deepEqual(selectCommemorationPersons(persons,'psalter-1',{mode:'group',group:'Семья',for:'living'}).map(p=>p.id),['a']);
        assert.deepEqual(selectCommemorationPersons(persons,'psalter-2',{mode:'group',group:'Семья',for:'departed'}).map(p=>p.id),['b']);
    });
    it('в утреннем блоке выбирает только соответствующий раздел группы',()=>{
        const choice={mode:'group' as const,group:'Семья'};
        assert.deepEqual(selectCommemorationPersons(persons,'morning-living',choice).map(p=>p.id),['a']);
        assert.deepEqual(selectCommemorationPersons(persons,'morning-departed',choice).map(p=>p.id),['b']);
        assert.deepEqual(selectCommemorationPersons(persons,'morning-living',{mode:'group',group:'Род'}),[]);
        assert.deepEqual(selectCommemorationPersons(persons,'psalter-1',{mode:'group',group:'Удалённая группа'}),[]);
    });
    it('все имена означает весь раздел, включая записи после двадцатой',()=>{
        const many=Array.from({length:10000},(_,i)=>person(String(i),'living',['Род']));
        const chosen=selectCommemorationPersons(many,'psalter-1',{mode:'living'});
        assert.equal(chosen.length,10000);assert.equal(chosen[9999].id,'9999');
    });
    it('считает группы из действующего помянника раздельно по живым и усопшим',()=>{
        assert.deepEqual(commemorationGroups(persons),[{name:'Друзья',living:1,departed:0},{name:'Род',living:0,departed:1},{name:'Семья',living:1,departed:1}]);
    });
    it('не позволяет изменить неизвестное место, добавить чужие поля или спутать разделы',()=>{
        for(const raw of [null,{},[],{other:{mode:'living'}},{'psalter-1':{mode:'other'}},{'psalter-2':{mode:'group',group:''}},
            {'psalter-2':{mode:'group',group:'a'.repeat(41)}},{'morning-living':{mode:'departed'}},{'morning-departed':{mode:'group',group:'Род',for:'living'}}]) assert.throws(()=>validateCommemorations(raw));
        assert.deepEqual(validateCommemorations({'psalter-1':{mode:'living',userId:'other',group:'ignored'}}),{'psalter-1':{mode:'living'}});
    });
});
