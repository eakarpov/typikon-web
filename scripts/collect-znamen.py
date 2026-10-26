#!/usr/bin/env python3
"""Read-only I/O adapter. Extract double-notation witnesses; TypeScript validates/indexes them.
Requests are sequential, cached, and explicitly decoded as windows-1251.
"""
import argparse, hashlib, html, json, re, time, urllib.parse, urllib.request
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',default='data/chant-corpus/znamen-v1');parser.add_argument('--refresh',action='store_true');parser.add_argument('--offline',action='store_true');args=parser.parse_args()
    root=Path(args.root);cache=root/'cache';rawdir=root/'raw';cache.mkdir(parents=True,exist_ok=True);rawdir.mkdir(exist_ok=True);bookdir=root/'books';bookdir.mkdir(exist_ok=True)
    day=datetime.now(ZoneInfo('Europe/Moscow')).date().isoformat();base='http://znamen.ru/';errors=[];pages=[];books=[];records=[];excluded=[];ids={'q333','5169'};titles={}
    def fetch(url):
        target=cache/(hashlib.sha256(url.encode()).hexdigest()+'.html')
        meta=target.with_suffix('.json')
        if meta.exists() and not args.refresh and json.loads(meta.read_text()).get('status')==404:raise urllib.error.HTTPError(url,404,'Cached unavailable source',None,None)
        if target.exists() and not args.refresh:

            cached=target.read_bytes()
            if meta.exists():
                proof=json.loads(meta.read_text())
                if proof.get('bytes')==len(cached) and proof.get('sha256')==hashlib.sha256(cached).hexdigest():return cached
            elif not url.endswith('.zf'):
                return cached
            else:
                if args.offline:raise RuntimeError('Unverified source cache; run collection online once')
                try:
                    with urllib.request.urlopen(urllib.request.Request(url,method='HEAD'),timeout=20) as response: expected=response.headers.get('Content-Length')
                    if expected is not None and int(expected)==len(cached):
                        meta.write_text(json.dumps({'url':url,'bytes':len(cached),'sha256':hashlib.sha256(cached).hexdigest(),'verifiedContentLength':int(expected)}));return cached
                    print('REPAIR CACHE',url,'cached bytes',len(cached),'expected',expected,flush=True)
                except Exception:pass
        if args.offline:raise RuntimeError('Source is not in the local archive cache')
        last=None
        for attempt in range(3):
            try:
                req=urllib.request.Request(url,headers={'User-Agent':'KruczieCorpus/0.1 (public textual sources; sequential cached requests)'})
                with urllib.request.urlopen(req,timeout=30) as response:
                    expected=response.headers.get('Content-Length')
                    if expected is not None and int(expected)>8000000:raise ValueError('Response exceeds 8MB')
                    data=response.read() if expected is not None else response.read(8000001)
                    if expected is not None and len(data)!=int(expected):raise ValueError('Incomplete HTTP response')
                if len(data)>8000000:raise ValueError('Response exceeds 8MB')
                temporary=target.with_suffix('.partial');temporary.write_bytes(data);temporary.replace(target)
                proof={'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'verifiedContentLength':int(expected) if expected else None}
                temporary=meta.with_suffix('.partial');temporary.write_text(json.dumps(proof));temporary.replace(meta)
                time.sleep(.2);return data
            except Exception as error:
                last=error
                if isinstance(error,urllib.error.HTTPError) and error.code==404:
                    meta.write_text(json.dumps({'url':url,'status':404,'checkedAt':day}));break
                time.sleep(.5)
        raise last
    # Finite top-level catalog scan, not recursive traversal of synonymous search URLs.
    seeds=['soder.php','src.php','n.php','treb.php']+[f'w.php?{g}10' for g in range(1,9)]+[f'irm_glas.php?Glas={g}' for g in range(1,9)]+['ogl.php?'+name for name in ['triwdp','z','p','minea','trezvon','glasy']]+[f'zf.php?w{g}0g*' for g in range(1,9)]
    for offset,path in enumerate(seeds):
        url=base+path
        try:
            data=fetch(url);text=data.decode('cp1251');pages.append({'url':url,'sha256':hashlib.sha256(data).hexdigest()})
            ids.update(re.findall(r'[?&]ruk=([A-Za-z0-9_]+)',html.unescape(text)))
            if path=='src.php':
                ids.update(re.findall(r'href=["\']?_([A-Za-z0-9]+)\.(?:php|htm)',text,re.I))
                plain=html.unescape(re.sub('<[^>]*>',' ',text))
                roman={'I':1,'II':2,'III':3,'IV':4,'V':5}
                for match in re.finditer(r'\b([FOQ])\.([IV]+)\.\s*(\d+)\.?',plain):
                    if match[2] in roman:
                        source=match[1].lower()+str(roman[match[2]])+match[3].zfill(2);ids.add(source);titles.setdefault(source,match[0].strip())
            for match in re.finditer(r'<td class=refopis>\s*<a title="([^"]+)"[^>]*>\s*<span class=refopis>\s*(?:&nbsp;)?([A-Za-z0-9_]+)',text):titles[match[2]]=html.unescape(match[1])
            print('CATALOG',offset+1,'/',len(seeds),'source IDs',len(ids),flush=True)
        except Exception as error:errors.append({'url':url,'stage':'catalog','message':str(error)})
    def save():
        report={'schemaVersion':1,'snapshot':day,'scope':'All available public source books discovered from top-level catalogs, manuscript signatures and eight Octoechos great-vespers lists are archived byte-for-byte. Directory listing is unavailable; undiscovered books cannot be claimed complete. Only double-notation sections train the model.',
            'encoding':'Source books explicitly decoded as windows-1251; retained sections are UTF-8 preserving CRLF. Source response checksums retained.', 'pages':pages,'books':books,'errors':errors,'excluded':excluded,'records':records,'sourceTitles':titles,'rightsUrl':base+'org.php#usl'}
        (root/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    for offset,source in enumerate(sorted(ids)):
        url=base+'ruk/'+source+'.zf'
        try:
            data=fetch(url)
            if b'<html' in data[:500].lower() or b'<!doctype' in data[:500].lower():raise ValueError('Server returned HTML instead of a source book')
            (bookdir/(source+'.zf')).write_bytes(data)
            text=data.decode('cp1251');cuts=list(re.finditer(r'^%код(?=[ \t\r\n]|$)[ \t]*([^\r\n]*)',text,re.M|re.I));prefix=text[:cuts[0].start()] if cuts else ''
            book={'sourceId':source,'url':url,'sha256':hashlib.sha256(data).hexdigest(),'sections':len(cuts),'retained':0,'rawPath':'books/'+source+'.zf','encoding':'windows-1251','bytes':len(data)};books.append(book)
            for ordinal,match in enumerate(cuts):
                section=text[match.start():cuts[ordinal+1].start() if ordinal+1<len(cuts) else len(text)]
                if not match[1].strip():excluded.append({'sourceId':source,'code':'','ordinal':ordinal,'reason':'unidentified-section'});continue
                musical=section.split('%Разница',1)[0]
                if not re.search(r'^%з[ \t]',musical,re.M) or not re.search(r'^%н[ \t]',musical,re.M):excluded.append({'sourceId':source,'code':match[1],'ordinal':ordinal,'reason':'not-double-notation'});continue
                code_field=match[1].split('//',1)[0].strip()
                aliases=[code_field] if re.match(r'^[a-z]=[^=\s]+$',code_field,re.I) else [value for value in re.split(r'\s*=\s*|\s+',code_field) if value]
                code=aliases[0] if aliases else code_field;raw=prefix+section
                tradition='demestvenny' if source=='f328' or '!d' in code else 'znamenny'
                sha=hashlib.sha256(raw.encode('utf8')).hexdigest();uid=hashlib.sha256((source+'::'+str(ordinal)+'::'+sha).encode()).hexdigest()[:20]
                (rawdir/(uid+'.zf')).write_bytes(raw.encode('utf8'))
                head=re.split(r'^%[зн][ \t]',section,maxsplit=1,flags=re.M)[0];clean=re.sub(r"[{}\\~'`^]",'',head)
                explicit=re.search(r'Гласъ?[.,:\s]*([1-8])',clean,re.I);octoechos=re.match(r'^w([1-8])[0-6][a-z]',code)
                tone=int(explicit[1]) if explicit else int(octoechos[1]) if octoechos else None
                attribution=re.findall(r'^%Набор[^\r\n]*(?:\r?\n(?!%).*)?',raw,re.M)
                records.append({'id':uid,'sourceId':source,'chantId':code,'chantAliases':aliases,'sourceOrdinal':ordinal,'url':base+'Give.php?'+urllib.parse.urlencode({'ruk':source,'id':code}),'sourceUrl':url,'sourceTitle':titles.get(source,source),
                    'tradition':tradition,'traditionEvidence':'catalog-demeственник-or-d-tag' if tradition=='demestvenny' else 'znamen-site-scope','notationKind':'double','genre':'sticheron' if re.match(r'^w[1-8][0-6][bgcluxsp]',code) else 'unspecified','tone':tone,'toneEvidence':'source-header' if explicit else 'octoechos-code' if octoechos else 'unknown',
                    'rawPath':'raw/'+uid+'.zf','sha256':sha,'responseSha256':book['sha256'],'transcription':'\n'.join(attribution),'retrievedAt':day,'rightsUrl':base+'org.php#usl','license':'No standard dataset license declared; original site terms and attribution apply'})
                book['retained']+=1
            print('BOOK',offset+1,'/',len(ids),source,'sections',len(cuts),'double',book['retained'],flush=True)
        except Exception as error:errors.append({'url':url,'sourceId':source,'stage':'book','message':str(error)});print('UNAVAILABLE',source,str(error),flush=True)
        save()
    # Clean stale extracted sections only inside this generated snapshot directory.
    retained={record['rawPath'].split('/')[-1] for record in records}
    for path in rawdir.glob('*.zf'):
        if path.name not in retained:path.unlink()
    save();print('DONE',len(records),'double witnesses from',sum(book['retained']>0 for book in books),'books; unavailable',len(errors),flush=True)
if __name__=='__main__':main()
