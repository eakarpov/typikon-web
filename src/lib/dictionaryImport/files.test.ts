import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashFile } from './files';
test('file hashing handles partial chunks and empty files with bounded memory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'dictionary-hash-'));try {
 const file=join(dir,'source');for(const input of [Buffer.alloc(0),Buffer.from('Церковнославянский словарь: исходные данные и локальные правки')]){
 writeFileSync(file,input);assert.equal(hashFile(file,7),createHash('sha256').update(input).digest('hex'));}
 assert.throws(()=>hashFile(file,0));assert.throws(()=>hashFile(join(dir,'missing')));
 }finally{rmSync(dir,{recursive:true});}
});
