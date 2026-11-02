import {createHash} from 'node:crypto';
import clientPromise from '@/lib/mongodb';
import {editionForLang,versesForCanonChapter} from '@/lib/bible/query';
import {parseScriptureRef} from '@/lib/bible/scriptureRef';
import {referenceChapterLengths} from '@/utils/bibleVersification';
import {missingVerses} from '@/lib/prayerCircle/coverage';
import type {Bundle} from './core';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export async function resolveScripture(bundle:Bundle):Promise<Bundle>{
 const refs=new Set(bundle.services.flatMap(s=>s.nodes.flatMap(n=>n.lines.filter(l=>l.absent==='external'&&l.address?.startsWith('bible:')).map(l=>l.address!))));
 const resolved=new Map<string,{text:string;edition:string;language:string}>();
 if(refs.size)try{
  const db=(await clientPromise).db('typikon'),edition=await editionForLang(db,'cs');
  if(edition&&edition.public!==false){const chapters=new Map<string,Awaited<ReturnType<typeof versesForCanonChapter>>>();
   for(const address of refs){const ref=parseScriptureRef(address);if(!ref)continue;const key=ref.canonId+':'+ref.chapter;let verses=chapters.get(key);if(!verses){verses=await versesForCanonChapter(db,edition._id,ref.canonId,ref.chapter);chapters.set(key,verses);}
    const from=ref.from??1,to=ref.to??(ref.from??referenceChapterLengths(ref.canonId)?.[ref.chapter-1]);
    if(!verses.length||!to||missingVerses(verses.map(v=>v.canonVerse),from,to).length)continue;
    resolved.set(address,{text:verses.filter(v=>v.canonVerse>=from&&v.canonVerse<=to).map(v=>v.content).join('\n'),edition:edition.code,language:edition.language});
   }
  }
 }catch{/* The unresolved addresses stay visible as incomplete, never fabricated. */}
 for(const s of bundle.services){const originalExternal=s.nodes.flatMap(n=>n.lines).filter(l=>l.absent==='external').length;for(const n of s.nodes){for(const l of n.lines){const text=l.address&&resolved.get(l.address);if(text&&l.absent==='external'){l.text=text.text;l.edition=text.edition;l.language=text.language;delete l.absent;l.contentHash=hash([l.text,l.address,l.edition]);}}
 n.contentHash=hash(n.lines.map(l=>l.contentHash));}
 const absent=s.nodes.flatMap(n=>n.lines.filter(l=>l.absent).map(l=>l.absent!));const missing=[...s.coverage.missing.filter(m=>m!=='external'||(s.coverage.absenceCounts?.external??0)>originalExternal),...absent];s.coverage.missing=Array.from(new Set(missing));s.coverage.texts=s.coverage.structure&&!s.coverage.errors.length&&!missing.length;
 s.id=hash([s.selection,bundle.corpusVersion,bundle.editorialVersion,s.nodes.map(n=>[n.id,n.contentHash])]);}
 return bundle;
}
