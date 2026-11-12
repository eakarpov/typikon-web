import { authorizeUser } from '@/lib/api/v2/user';
import { fail, preflight, respondPrivate } from '@/lib/api/v2/http';
import { reportError } from '@/lib/reportError';
import { posledovanieTexts, POSLEDOVANIYA, PRAYER_LANGS, type PrayerLang } from '@/lib/molitvoslov/store';
import { loadCommemorationContext, selectedNamedPersons, morningCommemorationIds } from '@/lib/pomyannik/commemorationPrayers';
import { fillMorningCommemorations } from '@/lib/prayerCircle/commemoration';
import { posledovanieRow } from '@/lib/api/v2/serialize';
import { readEnum } from '@/lib/api/v2/params';
export const dynamic = 'force-dynamic';
export const OPTIONS = () => preflight();
export async function GET(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied)
        return access.denied;
    const url = new URL(request.url);
    const lang = (readEnum(url, 'lang', PRAYER_LANGS) ?? 'cu') as PrayerLang;
    const gender = url.searchParams.get('gender') === 'f' ? 'f' : 'm';
    try {
        const found = posledovanieTexts(POSLEDOVANIYA.utrennie, lang, gender);
        if (!found)
            return fail('corpus_unavailable', 'Корпус недоступен.');
        const context = await loadCommemorationContext(access.userId);
        const [living, departed] = await Promise.all([selectedNamedPersons(context, 'morning-living'), selectedNamedPersons(context, 'morning-departed')]);
        const rows = fillMorningCommemorations(found.rows, morningCommemorationIds(), { living: living.living, departed: departed.departed }, gender);
        return respondPrivate({ key: 'utrennie', lang: found.lang, rows: rows.map(posledovanieRow) }, { access });
    }
    catch (e) {
        reportError(e, { where: 'api/v2/pomyannik/morning', source: 'api' });
        return fail('internal', 'Не удалось подставить имена.');
    }
}
