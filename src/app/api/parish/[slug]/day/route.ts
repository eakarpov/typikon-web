import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CacheTag } from '@/lib/cache';
import { rightsOn } from '@/lib/parish/access';
import { schedulePeriod } from '@/lib/parish/period';
import { validateDayConfig } from '@/lib/parish/dayConfig';
import { saveDayConfig } from '@/lib/parish/dayConfigStore';
import { ordoDay } from '@/lib/ordo';
import { getTemple } from '@/lib/temples';
import { getMemory } from '@/lib/memories';
export async function POST(request: Request, ctx: {
    params: Promise<{
        slug: string;
    }>;
}) {
    const { slug } = await ctx.params, rights = await rightsOn(slug);
    if (!rights.canEdit)
        return NextResponse.json({ error: 'Нет права редактировать этот храм' }, { status: 403 });
    try {
        const body = await request.json(), config = validateDayConfig(body);
        if (!schedulePeriod(String(body.period))?.dates.includes(config.date))
            throw Error('Дата вне выбранного периода');
        for (const id of config.memories)
            if (!await getMemory(id))
                throw Error('Память не найдена');
        if (config.memories.length || config.sign) {
            const temple = await getTemple(slug), base = await ordoDay(config.date, { ustav: temple?.ustav ?? undefined });
            if (!base)
                throw Error('Служба устава сейчас недоступна');
            const first = config.memories[0] ? await getMemory(config.memories[0]) : null;
            const chosen = await ordoDay(config.date, { ustav: temple?.ustav ?? undefined, memories: config.memories.length ? config.memories : base.memories.map(m => m.memoryId), serviceSign: config.sign ?? (config.memories.length ? first?.sign?.default ?? 'bez-znaka' : base.variants[0]?.sign) });
            if (!chosen)
                throw Error('Не удалось собрать выбранный состав службы');
        }
        await saveDayConfig(slug, config, rights.userId!);
        revalidateTag(CacheTag.PARISH);
        return NextResponse.json({ ok: true });
    }
    catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Не удалось сохранить' }, { status: 400 });
    }
}
