type Obj=Record<string,unknown>;
const obj=(v:unknown)=>v as Obj;
const ref=(name:string)=>({$ref:`#/components/schemas/${name}`});
/** Keep operation URLs; deprecate representations, not useful operations. */
export function installDictionaryProfiles(paths:Obj,schemas:Obj){
 const meta={type:'object',properties:{schemaVersion:{const:2},dictionaryVersion:{type:'string',minLength:1}},required:['schemaVersion','dictionaryVersion']};
 const form={type:'object',properties:{value:{type:'string'},grammar:{type:'string'},segments:{type:['array','null']},origin:{type:'string',enum:['stored','generated'],deprecated:true},formOrigin:{type:'string',enum:['dictionary','generated','attested','unknown']},reviewStatus:{type:'string',enum:['verified','proposed','disputed','unknown']},provenance:{type:'array',items:{type:'object'}},evidence:{type:'array',items:{type:'object'}}},required:['value','grammar','formOrigin','reviewStatus','provenance','evidence']};
 const forms={type:'array',items:ref('CsFormV2')};
 Object.assign(schemas,{CsFormV2:form});
 for(const [old,name] of [['CsSearch','CsSearchV2'],['CsArticle','CsArticleV2'],['CsRelationView','CsRelationViewV2'],['CsSource','CsSourceV2']]){
  const baseline=obj(schemas[old]);
  const extra:Obj=old==='CsArticle'?{properties:{extra:forms,paradigms:{type:'array',items:{type:'object',properties:{slots:{type:'array',items:{type:'object',properties:{forms}}}}}}},required:['sources','relatedSources','examples','paradigms','extra','relations','etymologies','usage','composition','properties']}:old==='CsSource'?{properties:{sourceVersion:{type:'string'},text:{type:'string'},publicationVersion:{type:'string',deprecated:true}},required:['sourceVersion','text','paragraphs','anchors','examples','publicationVersion']}:{};
  schemas[name]={allOf:[{...baseline,properties:{...obj(baseline.properties),version:{type:'string',deprecated:true}}},meta,extra]};
  // Only legacy responses lack schemaVersion; leave shared source/example types intact.
  Object.assign(baseline,{deprecated:true,not:{required:['schemaVersion']}});
 }
 for(const [path,representations] of [['/api/v2/cs/search',['CsSearch','CsSearchV2']],['/api/v2/cs/lexemes/{id}',['CsArticle','CsArticleV2','CsRelationView','CsRelationViewV2']],['/api/v2/cs/source-entries/{id}',['CsSource','CsSourceV2']]] as [string,string[]][]){
  const operation=obj(obj(paths[path]).get);
  operation.description='schema=2 закрепляет version публикации. Отсутствующий schema/schema=1 deprecated и сохраняет прежнее latest-поведение. Sunset не назначен.';
  operation.parameters=[...(operation.parameters as unknown[]),{name:'schema',in:'query',schema:{type:'integer',enum:[1,2],default:1}},{name:'version',in:'query',description:'В schema=2: точная словарная публикация. Недоступная версия — 409 без подстановки latest.',schema:{type:'string',pattern:'^[a-f0-9]{64}$'}}];
  const responses=obj(operation.responses);
  obj(obj(obj(responses['200']).content)['application/json']).schema={oneOf:representations.map(ref)};
  obj(responses['200']).headers={'X-Dictionary-Schema-Deprecated':{schema:{type:'string'},description:'true для schema=1'},Link:{schema:{type:'string'},description:'successor-version'}};
  responses['409']={description:'version_unavailable: запрошенная публикация недоступна'};
 }
}
