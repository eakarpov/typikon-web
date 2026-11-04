import test from 'node:test';
import assert from 'node:assert/strict';
import { DslParser, fragments, grammarEvidence, LexemeMatcher, recoverYa } from './core';
import type { DslEntry, LegacyLexeme } from './model';
const lexemes: LegacyLexeme[] = [
    { _id:'old-id', name:'па́ѵелъ',scheme:'LOCAL-FIX',properties:'S,m,anim', forms:[] },
    { _id:'peace',name:'ми́ръ',scheme:'N1t',properties:'S,m,inan' },
    { _id:'world',name:'мі́ръ',scheme:'N1t*',properties:'S,m,inan' },
    { _id:'homonym-1',name:'а́гнъ',scheme:'N1t',properties:'S,m' },
    { _id:'homonym-2',name:'а́гнъ',scheme:'N1t*',properties:'S,m' },
];
const entry = (header: string, body: string): DslEntry => ({id:header,headers:[header],body,line:1,endLine:4});
test('stream parser keeps aliases, source markup and final article; IDs do not depend on line numbers',()=>{
    const parse=(prefix:string[])=>{const p=new DslParser(),a:DslEntry[]=[];for(const l of [...prefix,'а҆́біе','а́біе','\t[m0][p]Св[/p] тотчас[/m]','б','\tbody']){const e=p.push(l);if(e)a.push(e);}const last=p.end();if(last)a.push(last);return a;};
    const a=parse(['\uFEFF#NAME "Dictionary"']);const b=parse(['#NAME "Dictionary"','','']);
    assert.equal(a.length,2);assert.deepEqual(a[0].headers,['а҆́біе','а́біе']);assert.equal(a[0].id,b[0].id);
    assert.match(a[0].body,/\[p\]Св/);assert.equal(a[1].body,'\tbody');
});
test('source fragments never silently combine explanations with different provenance',()=>{
    const e=entry('а','\t[m0][p]Св[/p] one[/m]\n\tcontinued\n\t[m0][p]Дч*[/p] two[/m]');
    const f=fragments(e);assert.equal(f.length,2);assert.equal(f[0].sourceCode,'Св');assert.match(f[0].raw,/continued/);assert.equal(f[1].sourceCode,'Дч*');assert.notEqual(f[0].id,f[1].id);
});
test('matching preserves IDs and local schemes, differentiates i, rejects homonym order guesses',()=>{
    const before=JSON.stringify(lexemes),m=new LexemeMatcher(lexemes);
    assert.equal(m.match('па́ѵелъ:','S,m,anim').lexemeId,'old-id');
    assert.equal(m.match('ми́ръ:','S,m,inan').lexemeId,'peace');assert.equal(m.match('мі́ръ:','S,m,inan').lexemeId,'world');
    assert.equal(m.match('а́гнъ_2:','S,m').lexemeId,null);assert.equal(m.match('а́гнъ_2:','S,m').method,'homonym-review');
    assert.equal(m.match('миръ:','S,m,inan').lexemeId,null);assert.equal(JSON.stringify(lexemes),before);
});
test('ya recovery keeps attested church forms and never invents a paradigm',()=>{
    const e=entry('я́рость:','\t[m0][p]gr[/p] S,f,inan[/m]\n\t[m0] [ref]ꙗ҆́рость[/ref] Св[/m]');
    const form=entry('ꙗ҆́рости','\t[m0][p]gr[/p] [ref]я́рость:[/ref] S,f,inan; sg,gen/dat/loc[/m]');
    const r=recoverYa(e,grammarEvidence(form),new LexemeMatcher(lexemes),new Map([['ꙗ҆́рость','source-id']]));
    assert.ok(r);assert.equal(r.scheme,'');assert.equal(r.morphologyStatus,'unassigned');assert.equal(r.name,'ꙗ҆́рость');assert.equal(r.orthographyStatus,'source-attested');assert.equal(r.forms[0].properties,'sg,gen/dat/loc');
    assert.equal(r._id,recoverYa(e,[],new LexemeMatcher(lexemes),new Map())?._id);
    assert.equal(recoverYa(e,[],new LexemeMatcher([{_id:'local-ya',name:'я́рость',scheme:'LOCAL',properties:'S,f,inan'}]),new Map()),null);
});
test('civil-only recovery does not become publishable church orthography automatically',()=>{
    const e=entry('я́ма:','\t[m0][p]gr[/p] S,f,inan[/m]');
    assert.equal(recoverYa(e,[],new LexemeMatcher([]),new Map())?.orthographyStatus,'needs-review');
    const p=new DslParser();p.push('header');assert.throws(()=>p.end(),/no body/);
});

test('simplified i and final grave match the literal church form supplied in the lemma index',()=>{
    const e=entry('явле́ніе:', '\t[m0][p]gr[/p] S,n,inan[/m]\n\t[m0] [ref]ꙗ҆вле́нїе[/ref] source (0)[/m]');
    const r=recoverYa(e,[],new LexemeMatcher([]),new Map());
    assert.equal(r?.name,'ꙗ҆вле́нїе');assert.equal(r?.orthographyStatus,'source-attested');assert.equal(r?.canonicalSourceEntryId,e.id);
    const grave=entry('ягня́:', '\t[m0][p]gr[/p] S,n,anim[/m]\n\t[m0] [ref]ꙗ҆гнѧ̀[/ref] source[/m]');
    assert.equal(recoverYa(grave,[],new LexemeMatcher([]),new Map())?.name,'ꙗ҆гнѧ̀');
});

test('reviewed cross-izvod spelling maps to the same ID without changing the canonical name',()=>{
    const l:LegacyLexeme={_id:'wonder-id',name:'чꙋ́до',scheme:'LOCAL',properties:'S,n,inan'};
    const variant={id:'old-spelling',lexemeId:'wonder-id',izvodId:'russian-old',value:'чю́до',scope:'lemma' as const,evidenceIds:['editorial-source'],reviewStatus:'verified' as const};
    const m=new LexemeMatcher([l],[variant]);
    assert.equal(m.match('чю́до:','S,n,inan','russian-old').lexemeId,l._id);
    assert.equal(m.match('чю́до:','S,n,inan','russian-old').method,'verified-orthography');
    assert.equal(m.match('чю́до:','S,n,inan','serbian').lexemeId,null);
    assert.equal(new LexemeMatcher([l],[{...variant,reviewStatus:'proposed'}]).match('чю́до:','S,n,inan','russian-old').lexemeId,null);
    assert.equal(l.name,'чꙋ́до');assert.equal(l.scheme,'LOCAL');
});

test('dictionary headword marker is preserved as source metadata, not exposed as a grammatical tag',()=>{
    const e=entry('я́кѡ:', '\t[m0][p]gr[/p] CONJ[/m]\n\t[m0] [ref]ꙗ҆́кѡ[/ref][/m]');
    const f=entry('ꙗ҆́кѡ','\t[m0][p]gr[/p] [ref]я́кѡ:[/ref] CONJ; :[/m]');
    const r=recoverYa(e,grammarEvidence(f),new LexemeMatcher([]),new Map());
    assert.equal(r?.forms[0].properties,'');assert.equal(r?.forms[0].sourceProperties,':');
});

test('hash-prefixed numeric aliases are headwords, not DSL directives',()=>{
 const p=new DslParser();p.push('#NAME "Numbers"');p.push('҂арѯ҃а');p.push('#аркса');p.push('\t[m0]число 1161[/m]');const e=p.end();
 assert.deepEqual(e?.headers,['҂арѯ҃а','#аркса']);
});

test('a hash-only article starts a new entry instead of merging its body into the preceding number',()=>{
 const p=new DslParser();p.push('число1');p.push('\tfirst');const first=p.push('#число2');p.push('\tsecond');const second=p.end();
 assert.equal(first?.body,'\tfirst');assert.deepEqual(second?.headers,['#число2']);assert.equal(second?.body,'\tsecond');
});
