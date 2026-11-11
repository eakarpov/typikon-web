import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endingSegmenter } from './endingSegments';
import { paradigmsFor } from './morphology';
const ending = (s: ReturnType<ReturnType<typeof endingSegmenter>>) => s.segments?.find(x => x.kind === 'ending')?.text;

test('finite verb uses the cell stem, not the infinitive stem', () => {
 const segment = endingSegmenter({ name: 'видотвори́ти', scheme: 'V21n' });
 assert.equal(ending(segment('verb', 'presSg2', 'видотвориши')), 'иши');
 const first = endingSegmenter({ name: 'воспо́льзовати', scheme: 'V12ov' });
 assert.equal(ending(first('verb', 'presSg2', 'воспо́льзꙋеши')), 'еши');
});
test('exact display spelling, stress and reflexive postfix are preserved', () => {
 const segment = endingSegmenter({ name: 'воспо́льзоватися', scheme: 'V12ov' });
 const value = 'воспо́льзꙋешисѧ';
 const result = segment('verb', 'presSg2', value);
 assert.equal(ending(result), 'еши');
 assert.equal(result.segments?.at(-1)?.kind, 'clitic');
 assert.equal(result.segments?.map(x => x.text).join(''), value);
});
test('adjective uk, fleeting vowel and hard sign are exact endings', () => {
 const s = endingSegmenter({ name: 'безпеча́льный', scheme: 'A1t*' });
 assert.equal(ending(s('adjective-plen','sgMNDat','безпеча́льномꙋ')), 'омꙋ');
 assert.equal(ending(s('adjective-brev','sgMNDat','безпеча́льнꙋ')), 'ꙋ');
 assert.equal(ending(s('adjective-brev','sgMNomAcc','без̑печа́ленъ')), 'ъ');
 assert.equal(s('adjective-plen','sgMNomAcc','без̑печа́лный').segments, null);
});
test('unconfirmed spellings, titla, superscripts and unknown schemes stay null', () => {
 const s = endingSegmenter({ name:'до́брый',scheme:'A1t' });
 assert.equal(s('adjective-plen','sgMNomAcc','дб҃рый').segments,null);
 assert.equal(s('adjective-plen','sgMNomAcc','доⷠрый').segments,null);
 assert.equal(s('adjective-plen','sgMNomAcc','до́брѣй').segments,null);
 assert.equal(endingSegmenter({ name:'слово',scheme:'UNKNOWN' })('noun','sgNom','слово').segments,null);
});
test('participle inflections use their own stem, excluding derivational suffixes', () => {
 const s=endingSegmenter({name:'воспо́льзовати',scheme:'V12ov'});
 assert.equal(ending(s('participle-plen','sgMNGen','воспо́льзꙋющагѡ','воспо́льзꙋющ')), 'агѡ');
 assert.equal(ending(s('participle-brev','sgMNDat','воспо́льзꙋющꙋ','воспо́льзꙋющ')), 'ꙋ');
 assert.equal(ending(s('participle-plen','sgMNDat','воспо́льзованомꙋ','воспо́льзован')), 'омꙋ');
});
test('paradigm builder enables confirmed participle segments and reconstructs every segmented form', () => {
 const p=paradigmsFor({name:'воспо́льзовати',scheme:'V12ov',properties:'V,ipf,tran'},'word');
 const participles=p.paradigms.filter(x=>x.kind.startsWith('participle-'));
 assert.equal(participles.length,8);
 for(const part of participles){
  assert.ok(part.slots.some(s=>s.forms.some(f=>f.segments)));
  for(const s of part.slots)for(const f of s.forms)if(f.segments)assert.equal(f.segments.map(x=>x.text).join(''),f.value);
 }
});
