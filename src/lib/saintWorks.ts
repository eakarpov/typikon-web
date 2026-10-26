import { BOOK_LABELS, SERVICE_LABELS, CANON_ROLE_LABELS, MARKER_LABELS } from '@/utils/chantLabels';
// Only explicit memory identities and approved/provenance links enter this query.
// No name or date matching: neither can identify a saint unambiguously.
export interface SaintWork {
    id: string; genre: string; reader: string; title: string;
    subtitle: string | null; language: string | null;
}
const marks = (n: number) => Array(n).fill('?').join(',');
const resolved = 'COALESCE(ci.text, f.text, other.text)';
const contentJoin = `LEFT JOIN fixed_texts f ON f.text_id=ci.ref_text_id
    LEFT JOIN content_items other ON other.item_id=ci.ref_item_id`;

export function saintWorks(db: any, memoryIds: string[], externalIds: string[]) {
    const requested = [...new Set(memoryIds.filter(Boolean))];
    const external = [...new Set(externalIds.filter(Boolean))];
    if (!requested.length && !external.length) return { items: [] as SaintWork[], memoryIds: [] as string[] };
    const where = [
        requested.length ? `memory_id IN (${marks(requested.length)})` : '',
        external.length ? `dneslov_id IN (${marks(external.length)})` : '',
    ].filter(Boolean).join(' OR ');
    const memories: any[] = db.prepare(`SELECT memory_id,label,book,month,day FROM memories WHERE ${where} ORDER BY memory_id`).all(...requested,...external);
    const ids: string[] = memories.map(m=>m.memory_id);
    if (!ids.length) return {items: [] as SaintWork[], memoryIds:ids};
    const items: SaintWork[]=[];
    const labels = new Map(memories.map(m=>[m.memory_id,m]));
    const subtitle = (m: any, tone?:number|null) => [BOOK_LABELS[m?.book]??m?.book,m?.month&&m?.day?`${m.day}.${m.month}`:null,tone?`Глас ${tone}`:null].filter(Boolean).join(' · ') || null;
    const seen = new Set<string>();
    const rows = db.prepare(`SELECT ci.item_id,ci.content_unit,ci.language,ci.marker,${resolved} AS text,g.memory_id,g.tone
        FROM content_items ci JOIN groups g ON g.group_id=ci.group_id ${contentJoin}
        WHERE g.memory_id IN (${marks(ids.length)}) AND ci.content_unit IN ('troparion','kontakion','velichanie')
        ORDER BY g.memory_id,g.group_id,ci.item_index,ci.item_id`).all(...ids);
    const genres:Record<string,string>={troparion:'troparion',kontakion:'kontakion',velichanie:'magnification'};
    for (const row of rows) {
        const text=(row.text??'').trim();
        if(!text) continue;
        const genre=genres[row.content_unit];
        const key=JSON.stringify([genre,row.language,row.tone,row.marker,text]);
        if(seen.has(key))continue;seen.add(key);
        items.push({id:String(row.item_id),genre,reader:'chant',title:text.replace(/\s+/g,' ').slice(0,110),subtitle:[subtitle(labels.get(row.memory_id),row.tone),MARKER_LABELS[row.marker]??row.marker].filter(Boolean).join(' · ')||null,language:row.language});
    }
    for(const c of db.prepare(`SELECT canon_id,memory_id,language,tone,service,role FROM canons
        WHERE memory_id IN (${marks(ids.length)}) AND EXISTS (SELECT 1 FROM content_items ci WHERE ci.canon_id=canons.canon_id) ORDER BY memory_id,rowid`).all(...ids)) {
        items.push({id:c.canon_id,genre:'canon',reader:'canon',title:c.role==='bogorodichen'?'Канон Богородицы':labels.get(c.memory_id)?.label??'Канон',subtitle:[subtitle(labels.get(c.memory_id),c.tone),SERVICE_LABELS[c.service]??c.service,CANON_ROLE_LABELS[c.role]??c.role].filter(Boolean).join(' · '),language:c.language});
    }
    for(const g of db.prepare(`SELECT DISTINCT g.memory_id,g.language FROM groups g WHERE g.memory_id IN (${marks(ids.length)})
        AND EXISTS(SELECT 1 FROM content_items ci WHERE ci.group_id=g.group_id) ORDER BY g.memory_id,g.language`).all(...ids)) {
        items.push({id:g.memory_id,genre:'service',reader:'service',title:labels.get(g.memory_id)?.label??'Служба',subtitle:subtitle(labels.get(g.memory_id)),language:g.language});
    }
    return { items, memoryIds:ids };
}

export function saintService(db:any,id:string,language:string|null) {
    const memory=db.prepare('SELECT memory_id,label,book FROM memories WHERE memory_id=?').get(id);
    if(!memory)return null;
    const rows=db.prepare(`SELECT ci.item_id,g.group_id AS groupId,ci.content_unit AS unit,ci.marker,${resolved} AS text,ci.inline_rubric AS rubric,
        ci.language,g.group_label AS label,g.service,g.tone
        FROM groups g JOIN content_items ci ON ci.group_id=g.group_id ${contentJoin}
        WHERE g.memory_id=? ${language?'AND g.language=?':''} ORDER BY g.group_id,ci.item_index,ci.item_id`)
        .all(...(language?[id,language]:[id]));
    const canons=db.prepare(`SELECT canon_id AS id,language,tone FROM canons WHERE memory_id=? ${language?'AND language=?':''} ORDER BY rowid`)
        .all(...(language?[id,language]:[id]));
    return {title:memory.label,book:memory.book,rows:rows.map((r:any)=>({...r,text:r.text??'',missing:!String(r.text??'').trim()})),canons};
}
