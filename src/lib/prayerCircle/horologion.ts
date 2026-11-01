import type Database from 'better-sqlite3';
/** Service belongs to the canon; the generic canon position has no service. */
export function horologionCanon(db:Pick<ReturnType<typeof Database>,'prepare'>,date:string,service:'compline'|'midnight',tone:number) {
    const weekday=new Date(date+'T12:00:00Z').getUTCDay();
    const day=['voskresenie','ponedelnik','vtornik','sreda','chetverg','pyatnitsa','subbota'][weekday];
    return db.prepare(`SELECT c.canon_id FROM canons c JOIN memories m ON m.memory_id=c.memory_id
        WHERE m.book='octoechos' AND m.weekday=? AND COALESCE(m.tone,c.tone)=?
        AND c.service=? AND c.language='cu_gr' ORDER BY c.canon_id LIMIT 1`).get(day,tone,service) as {canon_id:string}|undefined;
}
