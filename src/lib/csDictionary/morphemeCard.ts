import Ajv from 'ajv';
import schema from './morphemeCard.schema.json';
type Obj = Record<string, any>;
const structural = new Ajv({allErrors:true}).compile(schema);
const segmenter = new Intl.Segmenter('ru', {granularity:'grapheme'});

/** Validate stored claims. Never derive edges, dates or morpheme boundaries. */
export function validateMorphemeCard(card:Obj, exists:(id:string)=>boolean = ()=>true):void {
 if(!structural(card))throw Error('Invalid schema=2 morpheme card: '+JSON.stringify(structural.errors));
 const unique=(xs:Obj[])=>{const ids=xs.map(x=>x.id);if(new Set(ids).size!==ids.length)throw Error('Duplicate IDs');return new Map(xs.map(x=>[x.id,x]));};
 const sources=unique(card.sources),nodes=unique(card.etymology.nodes),relations=unique(card.etymology.relations);
 unique(card.composition.models);unique(card.composition.notes);unique(card.etymology.notes);unique(card.etymology.chains);
 const visit=(x:any):void=>{
  if(!x||typeof x!=='object')return;
  for(const e of x.evidence??[])if(!sources.has(e.sourceId))throw Error('Missing evidence source');
  if(x.target?.kind==='morpheme'&&!exists(x.target.id))throw Error('Missing morpheme target');
  if(x.period){const p=x.period;if(!p.evidence.length||p.fromYear!==null&&p.toYear!==null&&p.fromYear>p.toYear)throw Error('Unsubstantiated or invalid period');}
  if(x.variety&&!x.variety.evidence.length)throw Error('Unsubstantiated variety');
  Object.values(x).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v));
 };
 visit(card);
 const usedRelations=new Set<string>(),usedNodes=new Set<string>();
 for(const r of card.etymology.relations){
  if(!nodes.has(r.toNodeId)||r.fromNodeIds.some((id:string)=>!nodes.has(id)||id===r.toNodeId))throw Error('Invalid relation target');
  if(r.status==='approved'&&!r.evidence.length)throw Error('Approved relation needs evidence');
  usedNodes.add(r.toNodeId);r.fromNodeIds.forEach((id:string)=>usedNodes.add(id));
 }
 for(const chain of card.etymology.chains){
  if(!nodes.has(chain.focusNodeId))throw Error('Missing chain focus');usedNodes.add(chain.focusNodeId);
  const graph=new Map<string,string[]>();
  for(const id of chain.relationIds){
   const r=relations.get(id);if(!r)throw Error('Missing chain relation');usedRelations.add(id);
   if(r.type!=='comparison')for(const from of r.fromNodeIds)graph.set(from,[...(graph.get(from)??[]),r.toNodeId]);
  }
  const active=new Set<string>(),done=new Set<string>();
  const walk=(id:string):void=>{if(active.has(id))throw Error('Historical cycle');if(done.has(id))return;active.add(id);for(const next of graph.get(id)??[])walk(next);active.delete(id);done.add(id);};
  graph.forEach((_,id)=>walk(id));
 }
 if(usedRelations.size!==relations.size||usedNodes.size!==nodes.size)throw Error('Orphan graph entry');
 const variants=new Map<string,Obj>(card.allomorphs.map((x:Obj)=>[x.id,x]));
 for(const model of card.composition.models){
  const parts=unique(model.parts);
  if(model.allomorphIds.some((id:string)=>!variants.has(id)))throw Error('Missing allomorph scope');
  if(model.mappingMode==='unmapped'&&model.alignment.length)throw Error('Unmapped model has alignment');
  for(const id of model.allomorphIds){
   const written=variants.get(id)!.surface;
   const glyphs=Array.from(segmenter.segment(written),(x:any)=>x.segment as string);
   if(model.mappingMode==='concatenative'&&model.parts.map((p:Obj)=>p.surface??'').join('')!==written)throw Error('Composition changes spelling');
   for(const a of model.alignment.filter((x:Obj)=>x.allomorphId===id)){
    if(a.startGrapheme>=a.endGrapheme||a.endGrapheme>glyphs.length||a.partIds.some((pid:string)=>!parts.has(pid)))throw Error('Invalid grapheme alignment');
    if(model.mappingMode==='concatenative'&&(a.partIds.length!==1||glyphs.slice(a.startGrapheme,a.endGrapheme).join('')!==parts.get(a.partIds[0])!.surface))throw Error('Incorrect component alignment');
   }
   if(model.mappingMode!=='unmapped'){
    const covered=new Set<number>();for(const a of model.alignment.filter((x:Obj)=>x.allomorphId===id))for(let g=a.startGrapheme;g<a.endGrapheme;g++){if(model.mappingMode==='concatenative'&&covered.has(g))throw Error('Overlapping concatenation');covered.add(g);}
    if(covered.size!==glyphs.length)throw Error('Incomplete composition coverage');
   }
  }
  if(model.alignment.some((a:Obj)=>!model.allomorphIds.includes(a.allomorphId)))throw Error('Alignment outside model scope');
 }
 if(Buffer.byteLength(JSON.stringify(card),'utf8')>512*1024)throw Error('Morpheme card too large');
}

/** @deprecated schema=1 only. Remove 90 days after first public schema=2 client release; track in docs/morpheme-schema2.md. */
export function legacyMorphemeCard(card:Obj):Obj {
 const {schemaVersion,composition,etymology,sources,...header}=card;
 const sourceMap=new Map<string,Obj>(sources.map((s:Obj)=>[s.id,s]));
 const note=(n:Obj)=>({title:n.title,note:n.text,status:n.status,...(n.reconstruction!==null?{reconstruction:n.reconstruction}:{}),...(n.evidence.length?{sources:n.evidence.map((e:Obj)=>({title:sourceMap.get(e.sourceId)!.title,locator:e.locator}))}:{}),...(n.target?.kind==='morpheme'?{morphemeId:n.target.id}:{}),...(n.target?.kind==='interlex'?{protoId:n.target.protoId,...(n.target.bodySha256?{bodySha256:n.target.bodySha256}:{})}:{})});
 // Imported descriptions remain exact; do not duplicate them with derived prose.
 const structure=composition.notes.map(note);

 const history=etymology.notes.map(note);
 for(const chain of etymology.chains)history.push({title:chain.title,note:chain.note,status:chain.status});
 return {...header,structure,history};
}
