import {missingVerses} from './coverage';
import {preparationSlot,dueInCycle} from './preparation';
import clientPromise from '@/lib/mongodb';
import { rulesDb } from '@/lib/rulesDb';
import { canRedistribute } from '@/lib/molitvoslov/rights';
import { posledovanieTexts } from '@/lib/molitvoslov/store';
import { editionForLang, versesForCanonChapter } from '@/lib/bible/query';
import { DEFAULT_BIBLE_LANGUAGE } from '@/utils/bibleLanguage';
import { calcDayCached } from '@/lib/api/v2/calendar';
import { NAMED_STYLES,namedPrayerTexts } from '@/lib/molitvoslov/store';
import { renderNamedPrayer,type NamedPerson } from '@/lib/molitvoslov/named';
import { listPersons } from '@/lib/pomyannik/service';
import { slavonicNames } from '@/lib/pomyannik/slavonic';
import { MAX_NAMES_IN_NOTE } from '@/lib/pomyannik/types';
import { ordoDayKafizmy } from '@/lib/ordo';
import { mobileReadingPlan } from '@/lib/readingPlan/mobile';
import { blocksFor, compose, shiftDate, CircleError, type Block, type Row, type BlockResult, type Catalog, type CycleState } from './core';

export async function compiler<T>(path:string,params:Record<string,string>={}):Promise<T> {
    const base=process.env.ORDO_SERVICE_URL;
    if(!base)throw new CircleError('Сборщик последований пока недоступен.',503);
    const u=new URL(path,base);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
    let r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    // A bounded upstream rejects bursts quickly. Retry once, never fan out.
    if(r.status===503) {
        await new Promise(resolve=>setTimeout(resolve,2000));
        r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    }
    if(!r.ok)throw new CircleError('Не удалось собрать последование.',503);
    return r.json();
}
export async function getCatalog():Promise<Catalog> {
    let c:Catalog;
    const db=rulesDb();
    const has=db?.prepare("SELECT 1 FROM sqlite_master WHERE name='prayer_circle_catalog'").get();
    if(has) c=JSON.parse((db!.prepare('SELECT document FROM prayer_circle_catalog WHERE id=1').get() as {document:string}).document);
    else c=await compiler<Catalog>('/prayer-circle/catalog');
    const canons=(db?.prepare("SELECT canon_key AS key, canon_key AS title FROM canons WHERE kind='molebny' AND language='cu_gr' GROUP BY canon_key").all()??[]) as {key:string;title:string}[];
    for(const canon of canons)canon.title=c.options?.canons.find(o=>o.key===canon.key)?.title??'Канон';
    const akathists=(db?.prepare("SELECT akathist_id AS key,title,source_book FROM akathists ORDER BY title").all()??[]) as {key:string;title:string;source_book:string}[];
    let scripture:{key:string;title:string}[]=[];
    try {const mongo=(await clientPromise).db('typikon');const edition=await editionForLang(mongo,DEFAULT_BIBLE_LANGUAGE);
    const books=edition?await mongo.collection('bible_books').find({editionId:edition._id}).sort({order:1}).toArray():[];
    scripture=books.map(b=>({key:b.canonId as string,title:b.name as string}));}catch{/* Prayer sources and templates remain available without the Bible database. */}
    return {...c,options:{canons,scripture,akathists:akathists.filter(a=>a.source_book==='Триодь постная, суббота 5-й седмицы'||canRedistribute(a.source_book,'cu_gr')).map(({key,title})=>({key,title}))}};
}
async function scripture(key:string,chapter:number,from=1,to=1000):Promise<BlockResult> {
    const db=(await clientPromise).db('typikon');
    const edition=await editionForLang(db,DEFAULT_BIBLE_LANGUAGE);
    const book=edition?await db.collection('bible_books').findOne({editionId:edition._id,$or:[{canonId:key},{alias:key}]}):null;
    if(!book||!edition||edition.public===false)throw new CircleError('Издание или книга Писания не найдены.',503);
    const vs=await versesForCanonChapter(db,edition._id,book.canonId,chapter);
    const missing=missingVerses(vs.map(v=>v.canonVerse),from,to===1000?undefined:to);
    return {missing:missing.length?[`Отсутствуют стихи ${key} ${chapter}: ${missing.join(', ')}.`]:[],rows:vs.filter(v=>v.canonVerse>=from&&v.canonVerse<=to).map(v=>({id:`${chapter}:${v.canonVerse}`,kind:'text',label:`${chapter}:${v.canonVerse}`,text:v.content,language:edition.language,sourceBook:'bible',sourceEdition:edition.code,sourceLocator:`${book.canonId} ${chapter}:${v.canonVerse}`}))};
}
async function psalter(b:Block,date:string,cursor:number,gender:'m'|'f',userId?:string):Promise<BlockResult> {
    let ns:number[];
    if(b.mode==='continuous')ns=[Math.floor(cursor/3)+1];
    else if(b.mode==='scheduled')ns=b.schedule?.[String(new Date(date+'T12:00:00Z').getUTCDay()||7)]??[];
    else {const k=await ordoDayKafizmy(date);if(!k)throw new CircleError('Уставное расписание недоступно.',503);ns=b.part==='evening'?k.vespers:b.part==='morning'?[...k.midnight,...k.matins]:k.hours;}
    const rows:Row[]=[];const missing:string[]=[];
    const named:Row[]=[];
    if(b.departed){
        if(!userId)missing.push('Войдите для поимённого поминовения.');
        else try{
            const texts=namedPrayerTexts(NAMED_STYLES['psalter-departed'].departed,'cu_gr',gender);
            const persons=(await listPersons(userId)).filter(p=>p.kind==='departed').slice(0,MAX_NAMES_IN_NOTE);
            const forms=await slavonicNames(persons.map(p=>p.churchName||p.name));
            const names:NamedPerson[]=persons.map(p=>({name:forms[p.churchName||p.name]?.genitive??p.name,rank:p.rank,sex:p.sex}));
            if(!texts?.prayers.length)missing.push('Молитва поминовения недоступна.');
            for(const p of texts?.prayers??[])named.push({id:p.id,kind:'text',text:renderNamedPrayer(p.text,names,gender),sourceBook:'molitvoslov',language:'cu_gr'});
        }catch{missing.push('Не удалось загрузить имена из помянника.');}
    }
    for(let index=0;index<ns.length;index++) {
        const n=ns[index];
        const ref=await compiler<{parts:{psalm:number;from:number;to:number;statia:number}[]}>('/prayer-circle/psalter',{number:String(n),statia:b.mode==='continuous'&&b.unit==='statia'?String(cursor%3):'all'});
        for(let i=0;i<ref.parts.length;i++) {
            const part=ref.parts[i];const reading=await scripture('psaltir',part.psalm,part.from,part.to);const verses=reading.rows;missing.push(...reading.missing);
            if(!verses.length)missing.push(`Не удалось загрузить псалом ${part.psalm}.`);
            rows.push(...verses.map(r=>({...r,id:`${index}:${part.psalm}:${r.id}`})));
            const end=i===ref.parts.length-1||part.statia!==ref.parts[i+1].statia;
            if(end) {
                const slava=await compiler<BlockResult>('/prayer-circle/block',{date,kind:'formula',key:'psalter-slava'});
                rows.push(...slava.rows.map((r,j)=>({...r,id:`${index}:slava:${part.statia}:${j}`})));missing.push(...slava.missing);
                rows.push(...named.map((r,j)=>({...r,id:`${index}:names:${part.statia}:${j}`})));
            }
        }
        if(b.mode!=='continuous'||b.unit!=='statia'||cursor%3===2) {
            const tail=posledovanieTexts(`psaltir-kafizma-${n}`,'cu_gr',gender);
            if(!tail?.rows.length)missing.push(`Окончание ${n}-й кафизмы недоступно.`);
            else rows.push(...tail.rows.map((r,j)=>({id:`${index}:tail:${j}`,kind:r.note?'rubric':'text',text:r.text??r.note??'',label:r.label,repeatCount:r.repeatCount??1,poklon:r.poklon,sourceBook:'molitvoslov',language:'cu_gr'})));
        }
    }
    if(!ns.length)rows.push({id:'no-assignment',kind:'rubric',text:'На эту дату кафизмы по выбранному расписанию не назначены.'});
    return {rows,missing};
}
async function resolve(b:Block,date:string,cycle:CycleState,catalog:Catalog,userId?:string):Promise<BlockResult> {
    if(b.kind==='template') {
        const t=catalog.templates.find(t=>t.key===b.key&&t.status==='verified');
        if(!t)throw new CircleError('Редакция ещё не сверена.');

    }
    if(['template','canon','akathist'].includes(b.kind)) {
        const r=await compiler<BlockResult>('/prayer-circle/block',{date,kind:b.kind,key:b.key,part:b.part,lang:cycle.config.lang,gender:cycle.config.gender,count:String(b.count??100)});
        if(b.key==='jesus'&&b.durationMinutes)r.rows=r.rows.map(row=>({...row,repeatCount:1,note:`Читать в течение ${b.durationMinutes} мин. Продолжительность назначена вами.`}));
        const refused=r.rows.filter(r=>r.redistributable!==true);
        return {...r,rows:r.rows.filter(r=>r.redistributable===true),missing:[...r.missing,...(refused.length?['Некоторые тексты не разрешены к выдаче.']:[])]};
    }
    if(b.kind==='scripture')return scripture(b.key,b.chapter!,b.verseFrom,b.verseTo);
    if(b.kind==='psalter')return psalter(b,date,cycle.cursors[b.id]??0,cycle.config.gender,userId);
    if(b.kind==='reading-plan') {
        if(!userId)return {rows:[],missing:['Войдите для подключения личного плана.']};
        const p=await mobileReadingPlan(userId);
        if(!p?.current?.content||p.status!=='active')return {rows:[],missing:['В личном плане сейчас нет активного чтения.']};
        return {rows:[{id:`plan:${p.id}:${p.revision}`,kind:'text',label:p.current.title,text:p.current.content,footnotes:p.current.footnotes,markdown:p.current.markdown}],missing:[]};
    }
    const calculated=await calcDayCached(date,DEFAULT_BIBLE_LANGUAGE);
    const d=calculated?.day;
    const slots=b.key==='gospel'?['gospelLiturgy']:['apostleLiturgy','gospelLiturgy'];
    const rows:Row[]=[];
    for(const slot of slots)for(const [n,item] of (d?.[slot]?.items??[]).entries())if(item.pericope) {
        const p=item.pericope;const text=p.liturgicalText?.content??(p.verses??[]).map((v:any)=>`${v.chapter}:${v.verse} ${v.content}`).join('\n\n');
        if(text)rows.push({id:`${slot}:${n}`,kind:'text',label:p.label,text,language:'cu'});
    }
    return {rows,missing:rows.length?[]:['Чтения дня не найдены.']};
}
export async function assembleCycle(cycle:CycleState,userId?:string) {
    const catalog=await getCatalog(),blocks=blocksFor(cycle);const sections:{block:Block;cursor?:number;date:string;missing:string[];sources:string[];changes:unknown[];note?:string}[]=[];
    let rows:Row[]=[];const versions=new Set<string>(catalog.corpusVersion?[catalog.corpusVersion]:[]);let embeddingBase:string|undefined;
    // Sequential bounded assembly avoids opening dozens of upstream requests per client.
    for(const b of blocks) {
        const date=b.part==='evening'?cycle.key:shiftDate(cycle.key,1);let r:BlockResult;
        try{r=await resolve(b,date,cycle,catalog,userId);}catch(e){r={rows:[],missing:[e instanceof CircleError?e.message:'Не удалось загрузить этот блок.']};}
        const template=catalog.templates.find(t=>t.key===b.key);const sources=template?.sources??(b.kind==='canon'||b.kind==='akathist'?['kelia-order']:b.kind==='psalter'?['bible-eliz','psalter-prayers','sledpsalt']:b.kind==='scripture'||b.kind==='day-readings'?['bible-eliz']:[]);
        sections.push({block:b,...(b.kind==='psalter'&&b.mode==='continuous'?{cursor:cycle.cursors[b.id]??0}:{}),date,missing:r.missing,sources,changes:r.changes??[],note:template?.note});if(r.version)versions.add(r.version);
        const content=r.rows.map(row=>({...row,id:`${b.id}:${row.id}`,legacyId:row.legacyId?`${b.id}:${row.legacyId}`:undefined,blockId:b.id}));
        const heading:Row={id:`${b.id}:heading`,blockId:b.id,kind:'heading',text:b.title};
        const previous=sections.find(s=>s.block.id===embeddingBase)?.block;
        const scheme=catalog.compositionRules?.find(r=>r.bases.includes(previous?.key??'')&&r.supplements.includes(b.kind==='template'?b.key:b.kind));
        const canEmbed=b.placement==='embedded'&&!!scheme&&previous?.part===b.part&&(['canon','akathist'].includes(b.kind)||b.kind==='template'&&b.key==='trekhkanonnik');
        if(b.placement==='embedded'&&(!canEmbed||!rows.some(row=>row.blockId===previous?.id&&row.zone==='closing'))) {
            sections[sections.length-1].missing.push('Для этого состава и дня нет проверенного места включения. Показано самостоятельное чтение; выберите его в настройке блока.');
        }
        if(canEmbed) {
            const start=rows.findIndex(row=>row.blockId===previous.id);const prefix=rows.slice(0,start);
            rows=[...prefix,...compose(rows.slice(start),[heading,...content])];
        } else {rows.push(heading,...content);embeddingBase=b.kind==='template'&&['utrennie','na-son'].includes(b.key)?b.id:undefined;}
    }
    const communion=await assembleCommunion(cycle,catalog);
    const readerSections=sections.map(s=>({id:s.block.id,title:s.block.title}));
    for(const section of communion?.sections??[])if(section.due) {
        const id=`communion:${communion!.date}:${section.id}`;
        readerSections.push({id,title:section.title});
        rows.push({id:id+':heading',blockId:id,kind:'heading',text:section.title},...section.rows.map(r=>({...r,id:id+':'+r.id,blockId:id})));
    }
    const bookmark=cycle.bookmark?(rows.find(r=>r.legacyId===cycle.bookmark||r.id===cycle.bookmark)?.id??null):null;
    return {communion,cycle:cycle.key,sections,readerSections,rows,sources:catalog.sources,corpusVersions:[...versions],complete:sections.every(s=>!s.missing.length)&&(!communion||communion.sections.filter(s=>s.due).every(s=>!s.missing.length)),bookmark,bookmarkMissing:!!cycle.bookmark&&!bookmark,marks:cycle.marks,counters:cycle.counters};
}

async function assembleCommunion(cycle:CycleState,catalog:Catalog) {
    const plan=cycle.config.communion;if(!plan)return null;
    const sections:{id:string;title:string;rows:Row[];missing:string[]}[]=[];
    async function add(id:string,title:string,kind:Block['kind'],key:string) {
        const b:Block={id,title,kind,key,part:'day',weekdays:[1,2,3,4,5,6,7]};
        try{const r=await resolve(b,plan!.date,cycle,catalog);sections.push({id,title,rows:r.rows,missing:r.missing});}
        catch{sections.push({id,title,rows:[],missing:['Не удалось загрузить чтение.']});}
    }
    if(plan.customKeys) {
        const seen:Record<string,number>={};
        for(const key of plan.customKeys) {
            const occurrence=seen[key]??0;seen[key]=occurrence+1;
            await add(`custom:${key}:${occurrence}`,catalog.templates.find(t=>t.key===key)?.title??key,'template',key);
        }
    } else {
        const combined=await compiler<BlockResult>('/prayer-circle/block',{date:plan.date,kind:'template',key:'trekhkanonnik',lang:cycle.config.lang,gender:cycle.config.gender}).catch(()=>null);
        const pascha=combined?.changes?.some((p:any)=>p.period==='svetlaya');
        if(!combined)sections.push({id:'canons',title:'Каноны подготовки',rows:[],missing:['Не удалось определить календарный состав подготовки. Повторите загрузку.']});
        else if(pascha)sections.push({id:'pascha',title:'Пасхальный канон',rows:combined!.rows,missing:combined!.missing});
        else {
            await add('canon:0','Канон покаянный','canon','kanon-pokayanny');
            await add('canon:1','Канон Богородице','canon','kanon-bogorodice');
            await add('canon:2','Канон Ангелу хранителю','canon','kanon-angelu-hranitelyu');
        }
        await add('service','Последование ко Причащению','template','ko-prichashcheniyu');
        const service=sections[sections.length-1];
        const boundary=service.rows.findIndex(r=>/^(молитва\s+1(?:-|[,\s])|млтва\s+а[,\s])/.test((r.label??'').normalize('NFD').replace(/[\u0300-\u036f\u0483-\u0489\u2de0-\u2dff]/g,'').toLowerCase()));
        if(boundary>=0){const prayers=service.rows.splice(boundary);sections.push({id:'prayers',title:'Молитвы ко Причащению',rows:prayers,missing:[]});}
        else service.missing.push('Не найдена граница молитв ко Причащению. Последование сохранено целиком.');
    }
    await add('thanksgiving','Благодарственные по Причащении','template','blagodarstvennye');
    const preparatory=sections.filter(s=>!['service','prayers','thanksgiving'].includes(s.id));
    return {...plan,sections:sections.map(s=>{
        const slot=preparationSlot(plan,s.id,Math.max(0,preparatory.indexOf(s)),preparatory.length);
        return {...s,...slot,due:dueInCycle(cycle.key,slot.date,slot.part)};
    })};
}
