"""Prepare hypotheses only; reviewer overrides are never replaced by this output."""
import argparse,collections,hashlib,json,pathlib,re,sqlite3,unicodedata
p=argparse.ArgumentParser();p.add_argument('--publication',required=True);p.add_argument('--semantics',required=True);p.add_argument('--interlex',required=True);p.add_argument('--out',required=True);a=p.parse_args();out=pathlib.Path(a.out)
if out.exists():raise SystemExit('Output exists')
def key(v):
 return re.sub(r'ъ\b','',unicodedata.normalize('NFD',v).lower().translate(str.maketrans('ѣіѳё','еифе'))).strip()
def clean(v):return ''.join(c for c in key(v) if not unicodedata.combining(c))
def digest(v):return hashlib.sha256(v.encode()).hexdigest()
db=sqlite3.connect('file:'+str(pathlib.Path(a.publication).resolve())+'?mode=ro&immutable=1',uri=True)
raw=json.load(open(a.semantics));concepts={r['id']:r for r in raw['concepts']};bygloss=collections.defaultdict(set)
for s in raw['senses']:bygloss[clean(s['lemma'])].add(s['synsetId'])
articles={i:dict(name=n,pos=p,originalName=o) for i,n,p,o in db.execute("select id,name,json_extract(payload,'$.pos'),json_extract(payload,'$.originalName') from articles")};indexed=collections.defaultdict(list);pos={'noun':'N','verb':'V','adjective':'A'}
for aid,lid,text,translation in db.execute('select id,lexemeId,text,translation from anchors where translation is not null'):
 art=articles[lid]
 for gloss in translation.split(';'):
  for concept in bygloss.get(clean(gloss),set()):
   if pos.get(art['pos']) and concepts[concept]['pos'] not in [pos[art['pos']], 'Adj' if art['pos']=='adjective' else pos[art['pos']]]:continue
   indexed[concept].append(dict(lexemeId=lid,anchorId=aid,text=text[:220],name=art['name']))
relations={};perword=collections.Counter();antonyms=collections.defaultdict(set)
for x,y in raw['antonyms']:antonyms[x].add(y);antonyms[y].add(x)
for concept,entries in sorted(indexed.items()):
 for source in entries:
  targets=[('antonym',other,t) for other in sorted(antonyms[concept]) for t in indexed.get(other,[])]+[('synonym',concept,t) for t in entries]
  for kind,other,target in targets:
   if source['lexemeId']==target['lexemeId'] or perword[source['lexemeId']]>=40:continue
   rid=source['lexemeId']+':'+digest('|'.join([source['anchorId'],target['lexemeId'],target['anchorId'],kind]))
   if rid in relations:continue
   relations[rid]=dict(id=rid,type=kind,status='proposed',targetId=target['lexemeId'],targetName=target['name'],anchorId=source['anchorId'],anchorText=source['text'],targetAnchorId=target['anchorId'],basis='Сопоставление русских эквивалентов с '+concepts[concept]['title']+'; требуется проверка значения.',provider='ruwordnet',providerVersion=raw['version'],conceptIds=list(dict.fromkeys([concept,other])))
   perword[source['lexemeId']]+=1
# Verify a reference, not an inheritance claim: exact church-Slavonic witness quoted in the proto article.
proto=sqlite3.connect('file:'+str(pathlib.Path(a.interlex).resolve())+'?mode=ro&immutable=1',uri=True)
names=collections.defaultdict(list)
for lid,art in articles.items():names[clean(art['originalName'])].append(lid)
etymologies={}
for pid,lemma,body,url in proto.execute("select id,lemma,body,source_url from proto_slavic_words where body like '%цслав.%'"):
 for m in re.finditer(r'цслав\.\s+([а-яёѣіѳѵъьѧꙗꙋѡ҃́̀]+)',body,re.I):
  candidates=names.get(clean(m[1]),[])
  if len(candidates)!=1:continue
  lid=candidates[0];quote=body[max(0,m.start()-15):min(len(body),m.end()+140)].split('\n\n')[0]
  etymologies.setdefault(lid,[])
  if any(x['articleId']==pid for x in etymologies[lid]):continue
  etymologies[lid].append(dict(articleId=pid,lemma=lemma,relation='attested-in',evidence='В этимологической статье приведено свидетельство: '+quote,sourceUrl=url or '',status='proposed',bodySha256=digest(body)))
result=dict(relations=list(relations.values()),etymologies={},etymologyCandidates=etymologies,semanticProviderVersion=raw['version'],etymologyCandidateRule='Automatic search for a Church Slavonic witness and unique heading; may be false, requires source review; no inheritance claim',counts=dict(relations=len(relations),wordsWithRelations=len(perword),etymologyLinks=sum(map(len,etymologies.values())),wordsWithEtymology=len(etymologies)))
out.write_text(json.dumps(result,ensure_ascii=False));print(json.dumps(result['counts']))
