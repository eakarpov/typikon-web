import test from 'node:test';
import assert from 'node:assert/strict';
import { extractReferences, extractFrequency, unlinkedGrammar } from './structured';
test('internal, biblical, external and media pointers preserve their source targets',()=>{
    const rows=extractReferences('entry','[ref]язы́къ_2:[/ref] [url]bible_ref/Ps.1:1[/url] [url]https://example.org[/url] [s]vs.bmp[/s]');
    assert.deepEqual(rows.map(r=>r.kind),['internal','bible','external','media']);
    assert.equal(rows[0].target,'язы́къ_2:');assert.equal(rows[1].target,'bible_ref/Ps.1:1');
    assert.equal(extractReferences('entry','[ref]x[/ref]')[0].id,extractReferences('entry','[ref]x[/ref]')[0].id);
});
test('unknown frequency remains unknown, zero is preserved, overlapping subcorpora are not summed',()=>{
    assert.equal(extractFrequency('e','[p]чс[/p] *[*] ВЗ=5 ЕВ=6[/*]')?.total,null);
    assert.equal(extractFrequency('e','[p]чс[/p] 0[*] [/*]')?.total,0);
    const f=extractFrequency('e','[p]чс[/p] 7[*] ВЗ=5 ЕВ=6[/*]');assert.equal(f?.total,7);assert.deepEqual(f?.subcorpora,{ВЗ:5,ЕВ:6});
});
test('unlinked grammar labels are retained for review rather than silently discarded',()=>{
    const raw='[p]gr[/p] аѵгуста:⁺ ;\n[p]gr[/p] S,m\n[p]gr[/p] [ref]x:[/ref] S; sg,nom';
    assert.equal(unlinkedGrammar(raw).length,1);
});
