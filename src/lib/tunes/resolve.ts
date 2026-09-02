// Выбор напева для песнопения.
//
// Спрашивают его тремя признаками, и все три уже есть в корпусе: глас
// (groups.tone), подобен (groups.podoben) и род песнопения
// (content_items.content_unit). Заводить для этого своё описание не нужно —
// нужно только уметь по ним искать.
//
// Порядок отбора не произволен. ПОДОБЕН СИЛЬНЕЕ ГЛАСА: если книга подписала
// стихиру подобном, поётся именно он, а гласовый напев — то, чем поют, когда
// подобна не назначено (стихиры самогласные). Поставь мы гласовый напев выше,
// подобны не звучали бы никогда, хотя книга их назвала пять с половиной тысяч
// раз.
//
// ИЗВОД СИЛЬНЕЕ ОБЩЕГО НАПЕВА, но только внутри своей традиции: валаамский
// извод «До́ме Евфра́фов» — уточнение знаменного напева, а не замена ему, и при
// отсутствии местного берётся общий. Обратного отката нет: общий напев чужой
// традиции подставлять вместо местного нельзя, это было бы подменой.

import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";
import { tuneLibrary } from "./registry";
import type { Notation, Tradition, Tune } from "./types";

export interface ChantAddress {
    tone: number | null;
    podoben: string | null;
    genre: string | null;
}

export interface TunePreference {
    traditionId?: string | null;
    locality?: string | null;
}

export interface Resolved {
    tune: Tune;
    tradition: Tradition;
    /** Почему выбран именно этот напев — подпись для читателя. */
    why: string;
}

/**
 * Ключ подобна.
 *
 * Зачин в корпусе напечатан как в книге — с ударениями, прописной буквы,
 * иногда с запятой («Гроб Твой, Спа́се»). Сличать такие строки посимвольно
 * нельзя: «До́ме Евфра́фов» и «Доме Евфрафов» — один подобен, и разойтись они
 * не имеют права. Снимаем разметку тем же нормализатором, каким сличается весь
 * церковнославянский в проекте, и оставляем одни буквы.
 */
export const podobenKey = (podoben: string): string =>
    normalizeChurchSlavonic(podoben)
        .replace(/[^\p{L}\s]/gu, " ")
        .split(/\s+/)
        .filter(Boolean)
        .join(" ");

const matchesPodoben = (tune: Tune, address: ChantAddress): boolean =>
    tune.select.kind === "podoben"
    && !!address.podoben
    && podobenKey(tune.select.podoben) === podobenKey(address.podoben)
    && tune.select.tone === address.tone;

const matchesTone = (tune: Tune, address: ChantAddress): boolean =>
    tune.select.kind === "tone"
    && tune.select.tone === address.tone
    && tune.select.genre === address.genre;

/**
 * Напев из одной традиции. Возвращает null, когда традиции нечем петь этот
 * текст, — и это не ошибка: партесный обиход знает тропарь, стихиру и ирмос, а
 * величание не знает, и делать вид, что знает, незачем.
 */
export const resolveIn = (
    traditionId: string,
    address: ChantAddress,
    locality: string | null = null,
): Resolved | null => {
    const { traditions, tunes } = tuneLibrary();
    const tradition = traditions.find(t => t.id === traditionId);
    if (!tradition) return null;

    const own = tunes.filter(t => t.traditionId === traditionId);
    // Местный извод сначала, общий напев следом — в пределах одного признака.
    const byLocality = (list: Tune[]) =>
        list.find(t => locality && t.locality === locality) ?? list.find(t => t.locality === null) ?? null;

    const podoben = byLocality(own.filter(t => matchesPodoben(t, address)));
    if (podoben) {
        return {
            tune: podoben, tradition,
            why: `подобен «${(podoben.select as { podoben: string }).podoben}»`,
        };
    }

    const tone = byLocality(own.filter(t => matchesTone(t, address)));
    if (tone) {
        return { tune: tone, tradition, why: address.podoben ? "гласовый напев: подобна нет в напевах" : "гласовый напев" };
    }

    return null;
};

export interface TuneOffer {
    tradition: Tradition;
    resolved: Resolved | null;
}

/**
 * Что вообще можно спеть на этот текст — по всем традициям разом.
 *
 * Традиции без напева не прячем, а показываем пустыми: читателю важно видеть,
 * что знаменного напева на эту стихиру у нас пока нет, — иначе отсутствие
 * пункта в списке читается как «такой традиции не бывает».
 */
export const tuneOffers = (address: ChantAddress, preference: TunePreference = {}): TuneOffer[] =>
    tuneLibrary().traditions.map(tradition => ({
        tradition,
        resolved: resolveIn(tradition.id, address, preference.locality ?? null),
    }));

/** Первый напев, какой нашёлся: то, что показывается без всякого выбора. */
export const resolveTune = (address: ChantAddress, preference: TunePreference = {}): Resolved | null => {
    if (preference.traditionId) {
        return resolveIn(preference.traditionId, address, preference.locality ?? null);
    }
    for (const offer of tuneOffers(address, preference)) {
        if (offer.resolved) return offer.resolved;
    }
    return null;
};

/** Изводы, объявленные при этой традиции. */
export const localitiesOf = (traditionId: string) =>
    tuneLibrary().localities.filter(l => l.traditionId === traditionId);

export const scoresOf = (tune: Tune, notation: Notation) =>
    tune.scores.filter(s => s.notation === notation);
