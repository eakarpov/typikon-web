import clientPromise from "@/lib/mongodb";
import { guessTimezone } from "@/lib/timezones";
import type { Temple } from "@/lib/temples";
import { DEFAULT_RULES } from "./presets";
import type { ParishRule, ParishSettings } from "./types";

// НАСТРОЙКИ ПРИХОДА: пояс и свои правила.
//
// ПОКА ПРИХОД ИХ НЕ ТРОНУЛ — ИХ НЕТ. Записи в базе не заводится, и приход
// едет на умолчаниях из кода: наши поправки к пресетам доходят до него сами,
// и это правильно, пока он с ними согласен.
//
// КАК ТОЛЬКО ТРОНУЛ — правила КОПИРУЮТСЯ ему целиком и становятся его. Дальше
// наша правка умолчания его не касается вовсе: расписание висит на стене, и
// молча менять его мы не вправе. Оттого не наследование, а копия — с датой,
// от которой видно, насколько она отстала.

export interface StoredSettings {
    _id?: string;
    templeSlug: string;
    /** Пояс, названный приходом. Пусто — берём догадку по стране и долготе. */
    timezone?: string | null;
    /** Свои правила. Пусто — приход ещё едет на умолчаниях из кода. */
    rules?: ParishRule[] | null;
    /** Когда правила скопированы: по ней видно, от какого умолчания они пошли. */
    rulesCopiedAt?: Date | null;
    updatedAt?: Date;
    updatedBy?: string | null;
}

const collection = async () =>
    (await clientPromise).db("typikon").collection<StoredSettings>("parishSettings");

export const storedSettings = async (templeSlug: string) =>
    (await collection()).findOne({ _id: templeSlug } as never);

export const saveSettings = async (
    templeSlug: string, patch: Partial<StoredSettings>, userId: string,
) => {
    await (await collection()).updateOne(
        { _id: templeSlug } as never,
        { $set: { ...patch, templeSlug, updatedAt: new Date(), updatedBy: userId },
          $setOnInsert: { _id: templeSlug } as never },
        { upsert: true },
    );
};

/**
 * Скопировать умолчания приходу — один раз, при первой его правке.
 *
 * Возвращает правила, с которыми приход остался: уже свои, если были, или
 * свежую копию. Не «наследовать и переопределять»: наследование значило бы,
 * что наша правка однажды молча переставит ему час.
 */
export const ownRules = async (
    templeSlug: string, userId: string,
): Promise<ParishRule[]> => {
    const stored = await storedSettings(templeSlug);
    if (stored?.rules?.length) return stored.rules;
    const copy = DEFAULT_RULES.map(r => ({ ...r }));
    await saveSettings(templeSlug, { rules: copy, rulesCopiedAt: new Date() }, userId);
    return copy;
};

/** Пояс храма: сказанный приходом, а не сказанный — выведенный. */
export const timezoneOf = (temple: Temple, stored?: StoredSettings | null) => {
    if (stored?.timezone) return { tz: stored.timezone, how: "parish" as const };
    const g = guessTimezone(temple.country ?? null, temple.longitude);
    return { tz: g.tz ?? "Europe/Moscow", how: g.how };
};

/** Приход целиком: храм плюс то, что он о себе сказал. */
export const settingsFor = async (temple: Temple): Promise<ParishSettings & {
    timezoneHow: "parish" | "country" | "longitude" | null;
    ownRules: boolean;
}> => {
    const stored = await storedSettings(temple.slug);
    const { tz, how } = timezoneOf(temple, stored);
    return {
        slug: temple.slug,
        title: temple.name,
        timezone: tz,
        timezoneHow: how,
        ustav: temple.ustav ?? null,
        prestoly: (temple.prestoly ?? [])
            .filter(p => p.state !== "lost" && p.memoryIds?.length)
            .map(p => ({ memoryId: p.memoryIds[0], kind: p.kind ?? null, label: p.label ?? null })),
        rules: stored?.rules?.length ? stored.rules : DEFAULT_RULES,
        ownRules: Boolean(stored?.rules?.length),
    };
};
