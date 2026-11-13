import { joinNames, type NamedPerson, type PrayerGender } from '../molitvoslov/named';
import type {PersonKind} from './types';

/** В Псалтири список вставляется один раз: родственные категории не являются
 * местами подстановки, а имя духовника остаётся книжным «имярек». */
export function psalterCommemorationTexts(names:Record<PersonKind,NamedPerson[]>, gender:PrayerGender, third:boolean, kinds:PersonKind[]): {id:string;title:null;for:PersonKind;lang:"cu_gr";text:string;italic?:string[]}[] {
    const italic = ['роди́телей мои́х'];
    if(third) {
        const all = kinds.flatMap(kind => names[kind]);
        if(!all.length) return [];
        return [{id:'psalter-third',title:null,for:kinds[0] ?? 'living',lang:'cu_gr' as const,
            text:`Помяни́, Го́споди, рабо́в Твои́х: ${joinNames(all,gender)}, и всех правосла́вных христиа́н.`}];
    }
    return kinds.map(kind => {
        const list=joinNames(names[kind],gender);
        const insertion=list ? ` ${list}` : '';
        const text=kind==='living'
            ? `Спаси́, Го́споди, и поми́луй отца́ моего́ духо́внаго (имяре́к), роди́телей мои́х, сро́дников, нача́льников, наста́вников, благоде́телей, и рабо́в Твои́х${insertion}, и всех правосла́вных христиа́н.`
            : `Упоко́й, Го́споди, ду́ши усо́пших раб Твои́х: роди́телей мои́х, сро́дников, благоде́телей, и рабо́в Твои́х${insertion}, и всех правосла́вных христиа́н, и прости́ им вся согреше́ния во́льная и нево́льная, и да́руй им Ца́рствие Небе́сное.`;
        return {id:`psalter-${kind}`,title:null,for:kind,lang:'cu_gr' as const,text,italic};
    });
}
