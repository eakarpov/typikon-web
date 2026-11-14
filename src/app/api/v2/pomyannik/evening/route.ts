import {authorizeUser} from '@/lib/api/v2/user';
import {fail,preflight,respondPrivate} from '@/lib/api/v2/http';
import {posledovanieTexts,PRAYER_LANGS,type PrayerLang} from '@/lib/molitvoslov/store';
import {commemorationPrayers,loadCommemorationContext} from '@/lib/pomyannik/commemorationPrayers';
import {posledovanieRow} from '@/lib/api/v2/serialize';
import {readEnum} from '@/lib/api/v2/params';
import {reportError} from '@/lib/reportError';
export const dynamic='force-dynamic';
export const OPTIONS=()=>preflight();
export async function GET(request:Request) {
    const access=await authorizeUser(request,'pomyannik');if(access.denied)return access.denied;
    const url=new URL(request.url),lang=(readEnum(url,'lang',PRAYER_LANGS)??'cu') as PrayerLang;
    const gender=url.searchParams.get('gender')==='f'?'f':'m';
    try {
        const found=posledovanieTexts('na-son',lang,gender);
        if(!found)return fail('corpus_unavailable','Корпус недоступен.');
        const context=await loadCommemorationContext(access.userId);
        const blocks=await Promise.all([commemorationPrayers(context,'evening-living',lang,gender),commemorationPrayers(context,'evening-departed',lang,gender)]);
        const rows=found.rows.map(posledovanieRow);
        for(const block of blocks)for(const prayer of block.prayers)rows.push(posledovanieRow({label:'Поминовение из помянника',text:prayer.text}));
        return respondPrivate({key:'na-son',lang:found.lang,day:context.on,rotating:Boolean(context.settings['evening-living'].daily||context.settings['evening-departed'].daily),rows},{access});
    } catch(error) {reportError(error,{where:'api/v2/pomyannik/evening',source:'api'});return fail('internal','Не удалось подставить вечерние имена.');}
}
