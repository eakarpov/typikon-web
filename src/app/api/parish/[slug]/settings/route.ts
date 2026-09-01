import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CacheTag } from "@/lib/cache";
import { ZONES } from "@/lib/timezones";
import { rightsOn, touchAdmin } from "@/lib/parish/access";
import { ownRules, saveSettings } from "@/lib/parish/settings";
import type { ParishRule } from "@/lib/parish/types";

// Настройки прихода: пояс и свои правила.
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    const { slug } = await ctx.params;
    const rights = await rightsOn(slug);
    if (!rights.canEdit) {
        return NextResponse.json({ error: rights.userId ? "этот храм ведёте не вы" : "войдите" },
                                 { status: rights.userId ? 403 : 401 });
    }
    const body = await request.json().catch(() => null);

    if (body?.timezone !== undefined) {
        const tz = String(body.timezone);
        // Только пояс, который мы умеем объявить календарю: назвать любой
        // значило бы отдать подписчику TZID, который его календарь не поймёт
        if (!(tz in ZONES)) {
            return NextResponse.json({ error: "этого пояса мы не знаем" }, { status: 400 });
        }
        await saveSettings(slug, { timezone: tz }, rights.userId!);
    }

    if (body?.rule) {
        // ПЕРВАЯ ЖЕ ПРАВКА КОПИРУЕТ УМОЛЧАНИЯ ПРИХОДУ: дальше они его, и наши
        // поправки его не касаются
        const rules = await ownRules(slug, rights.userId!);
        const patch = body.rule as Partial<ParishRule> & { key: string };
        const i = rules.findIndex(r => r.key === patch.key);
        if (i < 0) return NextResponse.json({ error: "нет такого правила" }, { status: 404 });
        rules[i] = { ...rules[i], ...patch, source: "parish" };
        await saveSettings(slug, { rules }, rights.userId!);
    }

    // «ТАК У НАС ВСЕГДА»: правка одного дня становится правилом.
    //
    // Мост правка → правило РУЧНОЙ, и останется ручным. Обобщить один случай
    // на весь год машина не вправе: поставил час на Успение — и вот у него
    // все двунадесятые в этот час, хотя он думал об одном дне. Здесь условие
    // ПРЕДЛАГАЕТСЯ, собранное из признаков того самого дня, а согласится ли
    // с ним человек — его дело.
    if (body?.promote) {
        const p = body.promote as {
            key: string; label: string; when: Record<string, unknown>;
            part: string; time?: string; title?: string; note?: string;
        };
        const rules = await ownRules(slug, rights.userId!);
        const rule = {
            key: p.key, label: p.label, when: p.when,
            then: { set: { part: p.part, time: p.time, title: p.title } },
            note: p.note, source: "parish",
        } as unknown as ParishRule;
        const i = rules.findIndex(r => r.key === p.key);
        if (i >= 0) rules[i] = rule; else rules.push(rule);
        await saveSettings(slug, { rules }, rights.userId!);
    }

    if (body?.reset) {
        // Вернуться к умолчаниям — снять свою копию целиком, а не сверять по
        // одному: полумера тут запутала бы больше, чем помогла
        await saveSettings(slug, { rules: null, rulesCopiedAt: null }, rights.userId!);
    }

    await touchAdmin(slug, rights.userId!);
    revalidateTag(CacheTag.PARISH);
    return NextResponse.json({ ok: true });
}
