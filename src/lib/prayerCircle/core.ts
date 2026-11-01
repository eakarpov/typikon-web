export type Part = 'evening' | 'morning' | 'day';
export type BlockKind = 'template' | 'canon' | 'akathist' | 'psalter' | 'scripture' | 'day-readings' | 'reading-plan';
export interface Block {
    id: string; title: string; kind: BlockKind; key: string; part: Part; weekdays: number[];
    templateId?: string; count?: number; mode?: 'continuous' | 'scheduled' | 'liturgical';
    unit?: 'statia' | 'kathisma'; schedule?: Record<string, number[]>; departed?: boolean;
    chapter?: number; verseFrom?: number; verseTo?: number;
}
export interface Variant { id: string; title: string; blocks: Block[]; basedOn?: string }
export interface CircleConfig {
    variants: Variant[]; activeId: string; gender: 'm' | 'f'; lang: 'cu' | 'cu_gr'; timeZone: string;
    reminders: { morning: boolean; evening: boolean };
    communion?: { date: string; days: number; customKeys?: string[] };
}
export interface Row {
    id: string; blockId?: string; text: string; label?: string | null; kind: string; note?: string | null;
    repeatCount?: number; poklon?: string | boolean | null; language?: string; sourceBook?: string;
    redistributable?: boolean; zone?: string; footnotes?: string[]; markdown?: boolean;
}
export interface BlockResult { rows: Row[]; missing: string[]; changes?: unknown[]; version?: string }
export interface Source { id: string; title: string; url: string; role: string; status: string; locator?: string; edition?: string }
export interface Template { id: string; title: string; key: string; part: Part; status: string; sources: string[]; izvod: string; tradition: string; celebration: string }
export interface Catalog { version: number; sources: Source[]; templates: Template[]; options?: { canons: {key:string;title:string}[]; akathists: {key:string;title:string}[]; scripture: {key:string;title:string}[] } }
export interface CycleState {
    key: string; config: CircleConfig; overrides: Partial<Record<Part, string>>;
    marks: Record<string, boolean>; counters: Record<string, number>; bookmark?: string;
    cursors: Record<string, number>; advanced: string[];
}
export interface CircleState {
    revision: number; config: CircleConfig; communionMarks: Record<string,boolean>; pending?: { effectiveCycle: string; config: CircleConfig };
    cycles: Record<string, CycleState>; cursors: Record<string, number>; receipts: string[];
}
export class CircleError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const dateKey = (d: Date) => d.toISOString().slice(0,10);
export const shiftDate = (s: string, n: number) => dateKey(new Date(Date.parse(s+'T00:00:00Z') + n*86400000));
export function validDate(v: unknown): v is string {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '1900-01-01' && v <= '2099-12-31'
        && !Number.isNaN(Date.parse(v+'T00:00:00Z')) && dateKey(new Date(v+'T00:00:00Z')) === v;
}
export function cycleAt(now: Date, zone: string): string {
    const f = new Intl.DateTimeFormat('en-CA',{timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
    const p = Object.fromEntries(f.formatToParts(now).map(x=>[x.type,x.value]));
    const date = `${p.year}-${p.month}-${p.day}`;
    return +p.hour < 15 ? shiftDate(date,-1) : date;
}
const word = (v: unknown): v is string => typeof v === 'string' && !['__proto__','constructor','prototype'].includes(v) && /^[a-zA-Z0-9:_-]{1,100}$/.test(v);
const integer = (v: unknown, min:number,max:number): v is number => Number.isInteger(v) && Number(v)>=min && Number(v)<=max;
export function validateConfig(raw: unknown): CircleConfig {
    if (!raw || typeof raw !== 'object') throw new CircleError('Неверный круг.');
    const c = raw as CircleConfig;
    if (!Array.isArray(c.variants) || c.variants.length<1 || c.variants.length>32 || !word(c.activeId)
        || !['m','f'].includes(c.gender) || !['cu','cu_gr'].includes(c.lang)) throw new CircleError('Проверьте варианты правила.');
    if(typeof c.timeZone!=='string'||!c.timeZone||c.timeZone.length>80)throw new CircleError('Проверьте часовой пояс.');
    try { new Intl.DateTimeFormat('ru',{timeZone:c.timeZone}).format(); } catch { throw new CircleError('Проверьте часовой пояс.'); }
    if (!c.reminders || typeof c.reminders.morning !== 'boolean' || typeof c.reminders.evening !== 'boolean') throw new CircleError('Проверьте напоминания.');
    const ids = new Set<string>(), blockIds = new Set<string>();
    for (const v of c.variants) {
        if (!word(v.id) || ids.has(v.id) || typeof v.title!=='string' || !v.title.trim() || v.title.length>120 || !Array.isArray(v.blocks) || v.blocks.length>60) throw new CircleError('Неверный вариант правила.');
        ids.add(v.id);
        for (const b of v.blocks) {
            if (!word(b.id) || blockIds.has(b.id) || typeof b.title!=='string' || b.title.length>160 || !word(b.key)
                || !['evening','morning','day'].includes(b.part) || !['template','canon','akathist','psalter','scripture','day-readings','reading-plan'].includes(b.kind)
                || !Array.isArray(b.weekdays) || !b.weekdays.length || b.weekdays.length>7 || b.weekdays.some(d=>!integer(d,1,7)) || new Set(b.weekdays).size!==b.weekdays.length) throw new CircleError('Проверьте блок и дни недели.');
            blockIds.add(b.id);
            if (b.count!==undefined && !integer(b.count,1,10000)) throw new CircleError('Число повторений от 1 до 10000.');
            if (b.kind==='psalter') {
                if (!['continuous','scheduled','liturgical'].includes(b.mode??'') || !['statia','kathisma'].includes(b.unit??'')) throw new CircleError('Выберите способ чтения Псалтири.');
                if (b.mode==='scheduled' && (!b.schedule || Object.entries(b.schedule).some(([k,ns])=>!integer(+k,1,7)||!Array.isArray(ns)||ns.length>20||ns.some(n=>!integer(n,1,20))))) throw new CircleError('Проверьте расписание кафизм.');
            }
            if (b.kind==='scripture' && (!integer(b.chapter,1,150) || b.verseFrom!==undefined&&!integer(b.verseFrom,1,176) || b.verseTo!==undefined&&(!integer(b.verseTo,1,176)||b.verseTo<(b.verseFrom??1)))) throw new CircleError('Проверьте главу и стихи.');
        }
    }
    if (!ids.has(c.activeId)) throw new CircleError('Активный вариант не найден.');
    if (c.communion && (!validDate(c.communion.date)||!integer(c.communion.days,0,40)||c.communion.customKeys!==undefined&&(!Array.isArray(c.communion.customKeys)||c.communion.customKeys.length>20||c.communion.customKeys.some(k=>!word(k))))) throw new CircleError('Проверьте подготовку к Причащению.');
    // Reject oversized/unknown payloads before persistence, then retain only the public schema.
    if (JSON.stringify(c).length>60000) throw new CircleError('Слишком большой круг.');
    return {variants:c.variants.map(v=>({id:v.id,title:v.title.trim(),...(v.basedOn?{basedOn:v.basedOn}:{}),blocks:v.blocks.map(b=>({id:b.id,title:b.title,kind:b.kind,key:b.key,part:b.part,weekdays:b.weekdays,...(b.templateId?{templateId:b.templateId}:{}),...(b.count!==undefined?{count:b.count}:{}),...(b.mode?{mode:b.mode}:{}),...(b.unit?{unit:b.unit}:{}),...(b.schedule?{schedule:b.schedule}:{}),...(b.departed!==undefined?{departed:!!b.departed}:{}),...(b.chapter?{chapter:b.chapter}:{}),...(b.verseFrom?{verseFrom:b.verseFrom}:{}),...(b.verseTo?{verseTo:b.verseTo}:{})}))})),activeId:c.activeId,gender:c.gender,lang:c.lang,timeZone:c.timeZone,reminders:{morning:c.reminders.morning,evening:c.reminders.evening},...(c.communion?{communion:{date:c.communion.date,days:c.communion.days,...(c.communion.customKeys?{customKeys:c.communion.customKeys}:{})}}:{})};
}
export interface Preset {id:string;key:string;title:string;status:string;kind?:'template'|'psalter'}
export function availablePresets(catalog:Catalog):Preset[] {
    return [...catalog.templates.filter(t=>t.status==='verified'),{id:'psalter',key:'psaltir',title:'Псалтирь — в своём темпе',status:'verified',kind:'psalter' as const}];
}
export function presetVariant(t:Preset,id:string):Variant {
    if(t.status!=='verified'||!word(t.id)||!word(t.key)||!['template','psalter'].includes(t.kind??'template'))throw new CircleError('Последование ещё не проверено.');
    return {id,title:t.title,basedOn:t.id,blocks:(['evening','morning','day'] as Part[]).map(part=>({id:id+':'+part,title:t.title,kind:t.kind??'template',key:t.key,templateId:t.id,part,weekdays:[1,2,3,4,5,6,7],...(t.key==='jesus'?{count:100}:{}),...(t.kind==='psalter'?{mode:'continuous' as const,unit:'kathisma' as const,departed:false}:{})}))};
}
function selectPreset(s:CircleState,cycle:CycleState,op:Operation):string {
    const t=op.template as Preset;if(!t||t.id!==op.templateId)throw new CircleError('Последование не найдено.');
    const configs=[s.config,cycle.config,...(s.pending?[s.pending.config]:[])];
    const signature=(v:Variant)=>JSON.stringify(v.blocks.map(b=>[b.kind,b.key,b.part,b.weekdays,b.count,b.mode,b.unit,b.departed,b.schedule]));
    let id='ready:'+t.id;let variant=presetVariant(t,id);
    if(configs.some(c=>c.variants.some(v=>v.id===id&&signature(v)!==signature(variant)))){id+=':'+op.id;variant=presetVariant(t,id);}
    for(const c of configs)if(!c.variants.some(v=>v.id===id)){c.variants.push(structuredClone(variant));validateConfig(c);}
    if(t.kind==='psalter') {
        const cursor=op.startCursor??0;if(!integer(cursor,0,59))throw new CircleError('Неверное место Псалтири.');
        for(const b of variant.blocks)if(s.cursors[b.id]===undefined){s.cursors[b.id]=Number(cursor)-Number(cursor)%3;cycle.cursors[b.id]=s.cursors[b.id];}
    }
    return id;
}
export function initialConfig(zone='Europe/Moscow'): CircleConfig {
    return {activeId:'ordinary',gender:'m',lang:'cu_gr',timeZone:zone,reminders:{morning:false,evening:false},variants:[{id:'ordinary',title:'Обычное правило',blocks:[
        {id:'evening_prayerbook',title:'Молитвы на сон грядущим',kind:'template',key:'na-son',part:'evening',weekdays:[1,2,3,4,5,6,7]},
        {id:'morning_prayerbook',title:'Молитвы утренние',kind:'template',key:'utrennie',part:'morning',weekdays:[1,2,3,4,5,6,7]},
        {id:'gospel',title:'Евангелие дня',kind:'day-readings',key:'gospel',part:'morning',weekdays:[1,2,3,4,5,6,7]}]}]};
}
export function createState(config: CircleConfig): CircleState { return {revision:0,config:validateConfig(config),cycles:{},cursors:{},communionMarks:{},receipts:[]}; }
export function ensureCycle(state: CircleState,key: string): CycleState {
    if (!validDate(key)) throw new CircleError('Неверная дата.');
    const config=state.pending&&key>=state.pending.effectiveCycle?state.pending.config:state.config;
    if (!state.cycles[key]) state.cycles[key]={key,config:structuredClone(config),overrides:{},marks:{...(state.communionMarks??{})},counters:{},cursors:{...state.cursors},advanced:[]};
    // Keep the latest forty opened cycles; ongoing sequential cursors live separately.
    const keys=Object.keys(state.cycles).filter(k=>k!==key).sort();for (const old of keys.slice(0,-39)) delete state.cycles[old];
    Object.assign(state.cycles[key].marks,state.communionMarks??{});
    return state.cycles[key];
}
export function blocksFor(cycle: CycleState): Block[] {
    return (['evening','morning','day'] as Part[]).flatMap(part=>{
        const v=cycle.config.variants.find(v=>v.id===(cycle.overrides[part]??cycle.config.activeId));
        const d=part==='evening'?cycle.key:shiftDate(cycle.key,1);const day=new Date(d+'T12:00:00Z').getUTCDay()||7;
        return (v?.blocks??[]).filter(b=>b.part===part&&b.weekdays.includes(day));
    });
}
function replaceCycleConfig(cycle:CycleState,config:CircleConfig) {
    const content=(b:Block)=>JSON.stringify([b.kind,b.key,b.part,b.templateId,b.count,b.mode,b.unit,b.schedule,b.departed,b.chapter,b.verseFrom,b.verseTo]);
    const old=new Map(cycle.config.variants.flatMap(v=>v.blocks).map(b=>[b.id,content(b)]));
    const compatible=new Set(config.variants.flatMap(v=>v.blocks).filter(b=>old.get(b.id)===content(b)).map(b=>b.id));
    for(const id of Object.keys(cycle.marks))if(!id.startsWith('communion:')&&!compatible.has(id))delete cycle.marks[id];
    for(const id of Object.keys(cycle.counters))if(!compatible.has(id))delete cycle.counters[id];
    // Keep advancement receipts even after a changed block, so applying today cannot reread-advance it twice.
    cycle.config=structuredClone(config);cycle.overrides={};
}
export type Operation = {id:string;revision:number;cycle:string;action:'config'|'override'|'mark'|'bookmark'|'counter'|'communion-mark'|'communion-plan';[key:string]:unknown};
export function applyOperation(original: CircleState,op: Operation,now=new Date()): CircleState {
    if (!word(op.id)||!validDate(op.cycle)) throw new CircleError('Неверная операция.');
    if (original.receipts.includes(op.id)) return original;
    if (op.revision!==original.revision) throw new CircleError('Круг изменился на другом устройстве. Обновите данные; ваши изменения сохранены локально.',409);
    const s=structuredClone(original),cycle=ensureCycle(s,op.cycle);
    if(op.action==='config') {
        const config=validateConfig(op.config);const current=cycleAt(now,s.config.timeZone);
        for(const b of config.variants.flatMap(v=>v.blocks))if(b.kind==='psalter'&&s.cursors[b.id]===undefined){s.cursors[b.id]=0;cycle.cursors[b.id]=0;}
        if(op.applyToday===true) {
            const target=ensureCycle(s,current);replaceCycleConfig(target,config);s.config=config;delete s.pending;
            for(const [key,snapshot] of Object.entries(s.cycles))if(key>current){replaceCycleConfig(snapshot,config);}
        } else {
            const effectiveCycle=shiftDate(current,1);s.pending={effectiveCycle,config};
            for(const [key,snapshot] of Object.entries(s.cycles))if(key>=effectiveCycle){replaceCycleConfig(snapshot,config);}
        }
    } else if(op.action==='override') {
        if(!['evening','morning','day'].includes(String(op.part)))throw new CircleError('Неверная часть дня.');
        const id=op.templateId!==undefined?selectPreset(s,cycle,op):String(op.variantId);
        if(!cycle.config.variants.some(v=>v.id===id))throw new CircleError('Вариант не найден.');
        cycle.overrides[op.part as Part]=id;
    } else if(op.action==='bookmark') {
        if(typeof op.rowId!=='string'||op.rowId.length>240)throw new CircleError('Неверная закладка.');cycle.bookmark=op.rowId;
    } else if(op.action==='communion-plan') {
        const candidate=validateConfig({...s.config,communion:op.plan??undefined});
        const plan=candidate.communion;
        s.config.communion=plan;if(s.pending)s.pending.config.communion=plan;
        const current=cycleAt(now,s.config.timeZone);
        const target=ensureCycle(s,current);target.config.communion=plan;
        for(const [date,snapshot] of Object.entries(s.cycles))if(date>current)snapshot.config.communion=plan;
} else if(op.action==='communion-mark') {
        if(!cycle.config.communion||!word(op.blockId)||typeof op.done!=='boolean')throw new CircleError('Подготовка не выбрана.');
        const key='communion:'+cycle.config.communion.date+':'+op.blockId;
        s.communionMarks={...(s.communionMarks??{}),[key]:op.done};
        for(const snapshot of Object.values(s.cycles))snapshot.marks[key]=op.done;
    } else {
        const b=blocksFor(cycle).find(b=>b.id===op.blockId);if(!b)throw new CircleError('Блок отсутствует в этом дне.');
        if(op.action==='mark') {
            if(typeof op.done!=='boolean')throw new CircleError('Неверная отметка.');cycle.marks[b.id]=op.done;
            if(op.done && b.kind==='psalter'&&b.mode==='continuous'&&!cycle.advanced.includes(b.id)) {
                if((s.cursors[b.id]??0)!==(cycle.cursors[b.id]??0))throw new CircleError('Место Псалтири изменилось. Обновите круг.',409);
                s.cursors[b.id]=((cycle.cursors[b.id]??0)+(b.unit==='statia'?1:3))%60;cycle.advanced.push(b.id);
            }
        } else if(op.action==='counter') {
            if(!integer(op.count,0,b.key==='bogorodichnoe'?150:b.count??10000)) throw new CircleError('Неверный счётчик.');cycle.counters[b.id]=op.count;
        } else throw new CircleError('Неизвестная операция.');
    }
    s.revision++;s.receipts=[...s.receipts,op.id].slice(-2000);return s;
}
/** Place verified supplements at the structural closing slot, never deduplicate words. */
export function compose(base: Row[],supplement: Row[]): Row[] {
    const at=base.findIndex(r=>r.zone==='closing');
    if(at<0)return [...base,...supplement];
    return [...base.slice(0,at),...supplement.filter(r=>r.zone!=='opening'&&r.zone!=='closing'),...base.slice(at)];
}
