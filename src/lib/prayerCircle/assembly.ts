import { ObjectId } from 'mongodb';
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
    const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(15000)});
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
async function scripture(key:string,chapter:number,from=1,to=1000):Promise<Row[]> {
    const db=(await clientPromise).db('typikon');
    const edition=await editionForLang(db,DEFAULT_BIBLE_LANGUAGE);
    const book=edition?await db.collection('bible_books').findOne({editionId:edition._id,$or:[{canonId:key},{alias:key}]}):null;
    if(!book||!edition)throw new CircleError('Издание или книга Писания не найдены.',503);
    const vs=await versesForCanonChapter(db,edition._id,book.canonId,chapter);
    return vs.filter(v=>v.canonVerse>=from&&v.canonVerse<=to).map(v=>({id:`${chapter}:${v.canonVerse}`,kind:'text',label:`${chapter}:${v.canonVerse}`,text:v.content,language:'cu',sourceBook:'bible'}));
}
async function reading(id:string):Promise<Row[]> {
    const db=(await clientPromise).db('typikon');const t=await db.collection('texts').findOne({_id:new ObjectId(id)});
    if(!t||!t.content||t.bookId&&await db.collection('books').findOne({_id:t.bookId,public:false}))throw new CircleError('Текст недоступен.',503);
    return [{id,kind:'text',text:t.content,footnotes:t.footnotes??[],markdown:!!t.newUi,language:t.csSource?'cu':'cu_gr',sourceBook:'library'}];
}
const midnightIds=['67dbc9c427c94f2d975da68a','67dbdbb0593e26758a828d09','67dbdcd6593e26758a828d0b'];
async function horologion(b:Block,date:string):Promise<BlockResult> {
    // Published lay-reader texts already used by the mobile rule. Never strip priest lines.
    const weekday=new Date(date+'T12:00:00Z').getUTCDay();
    const ids=b.part==='evening'?['67df2a9b94428ce850c0f9af']:['67e0472294428ce850c0f9bd',midnightIds[weekday===0?2:weekday===6?1:0]];
    const rows:Row[]=[];
    for(const id of ids)rows.push(...await reading(id));
    // Until the calendar canon is resolved below, a rubric slot is explicitly incomplete.
    const needs=b.part==='evening'||weekday===0;
    if(needs) {
        const kind=b.part==='evening'?'compline':'midnight';
        const raw=await compiler<any>('/day',{date});
        const tone=raw?.day?.tone;
        const day=['voskresenie','ponedelnik','vtornik','sreda','chetverg','pyatnica','subbota'][weekday];
        const canon=rulesDb()?.prepare(`SELECT c.canon_key,c.canon_id FROM canons c JOIN memories m ON m.memory_id=c.memory_id JOIN positions p ON p.position_id=c.position_id WHERE m.book='octoechos' AND m.weekday=? AND COALESCE(m.tone,c.tone)=? AND p.service=? AND c.language='cu_gr' LIMIT 1`).get(day,tone,kind) as {canon_key:string;canon_id:string}|undefined;
        if(!canon)return {rows,missing:['Канон Часослова для дня и гласа не подобран.']};
        // Use structured canon lines and the book's rubric insertion marker.
        const lines=rulesDb()!.prepare('SELECT text,ode,content_unit FROM content_items WHERE canon_id=? ORDER BY ode,item_index').all(canon.canon_id) as {text:string;ode:number;content_unit:string}[];
        const text=rows[rows.length-1].text;
        const matches=[...text.matchAll(/\{k\|[^}]*\}/g)];
        const marker=matches.find(m=>/(чтем|глаголем)\s+канон/.test(m[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
        if(!marker)return {rows,missing:['В книге не найдено место канона.']};
        const last=rows.pop()!;rows.push({...last,id:last.id+':before',text:text.slice(0,marker.index)},...lines.map((l,n)=>({id:`canon:${n}`,text:l.text,kind:'text',label:`Песнь ${l.ode}`,sourceBook:'octoechos',language:'cu_gr'})),{...last,id:last.id+':after',text:text.slice(marker.index!+marker[0].length)});
    }
    return {rows,missing:[]};
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
            const part=ref.parts[i];const verses=await scripture('psaltir',part.psalm,part.from,part.to);
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
        if(b.key==='horologion')return horologion(b,date);
    }
    if(['template','canon','akathist'].includes(b.kind)) {
        const r=await compiler<BlockResult>('/prayer-circle/block',{date,kind:b.kind,key:b.key,lang:cycle.config.lang,gender:cycle.config.gender,count:String(b.count??100)});
        const refused=r.rows.filter(r=>r.redistributable!==true);
        return {...r,rows:r.rows.filter(r=>r.redistributable===true),missing:[...r.missing,...(refused.length?['Некоторые тексты не разрешены к выдаче.']:[])]};
    }
    if(b.kind==='scripture'){const rows=await scripture(b.key,b.chapter!,b.verseFrom,b.verseTo);return {rows,missing:rows.length?[]:['Выбранные стихи не найдены в издании.']};}
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
    const catalog=await getCatalog(),blocks=blocksFor(cycle);const sections:{block:Block;date:string;missing:string[];sources:string[];changes:unknown[]}[]=[];
    let rows:Row[]=[];const versions=new Set<string>();let embeddingBase:string|undefined;
    // Sequential bounded assembly avoids opening dozens of upstream requests per client.
    for(const b of blocks) {
        const date=b.part==='evening'?cycle.key:shiftDate(cycle.key,1);let r:BlockResult;
        try{r=await resolve(b,date,cycle,catalog,userId);}catch(e){r={rows:[],missing:[e instanceof CircleError?e.message:'Не удалось загрузить этот блок.']};}
        const template=catalog.templates.find(t=>t.key===b.key);const sources=template?.sources??(b.kind==='canon'||b.kind==='akathist'?['kelia-order']:b.kind==='psalter'?['sledpsalt']:[]);
        sections.push({block:b,date,missing:r.missing,sources,changes:r.changes??[]});if(r.version)versions.add(r.version);
        const content=r.rows.map(row=>({...row,id:`${b.id}:${row.id}`,blockId:b.id}));
        const heading:Row={id:`${b.id}:heading`,blockId:b.id,kind:'heading',text:b.title};
        const previous=sections.find(s=>s.block.id===embeddingBase)?.block;
        const canEmbed=previous?.part===b.part&&(['canon','akathist'].includes(b.kind)||b.kind==='template'&&b.key==='trekhkanonnik');
        if(canEmbed) {
            const start=rows.findIndex(row=>row.blockId===previous.id);const prefix=rows.slice(0,start);
            rows=[...prefix,...compose(rows.slice(start),[heading,...content])];
        } else {rows.push(heading,...content);embeddingBase=b.kind==='template'&&['utrennie','na-son'].includes(b.key)?b.id:undefined;}
    }
    const communion=await assembleCommunion(cycle,catalog);
    return {communion,cycle:cycle.key,sections,rows,sources:catalog.sources,corpusVersions:[...versions],complete:sections.every(s=>!s.missing.length)&&(!communion||communion.sections.every(s=>!s.missing.length)),bookmark:cycle.bookmark??null,marks:cycle.marks,counters:cycle.counters};
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
        for(const [i,key] of plan.customKeys.entries())await add('custom:'+i,catalog.templates.find(t=>t.key===key)?.title??key,'template',key);
    } else {
        const combined=await compiler<BlockResult>('/prayer-circle/block',{date:plan.date,kind:'template',key:'trekhkanonnik',lang:cycle.config.lang,gender:cycle.config.gender}).catch(()=>null);
        const pascha=combined?.changes?.some((p:any)=>p.period==='svetlaya');
        if(pascha)sections.push({id:'pascha',title:'Пасхальный канон',rows:combined!.rows,missing:combined!.missing});
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
    return {...plan,sections};
}
