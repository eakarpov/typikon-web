import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivate } from "@/lib/api/v2/http";
import { readEnum } from "@/lib/api/v2/params";
import { namedPrayer } from "@/lib/api/v2/serialize";
import { renderNamedPrayer, type NamedPerson, type PrayerGender } from "@/lib/molitvoslov/named";
import {
    NAMED_FOR_KINDS, NAMED_STYLES, namedPrayerTexts,
    PRAYER_LANGS, type NamedFor, type NamedStyleKey, type PrayerLang,
} from "@/lib/molitvoslov/store";
import { listPersons } from "@/lib/pomyannik/service";
import { slavonicNames } from "@/lib/pomyannik/slavonic";
import { MAX_NAMES_IN_NOTE } from "@/lib/pomyannik/types";
import { reportError } from "@/lib/reportError";

// ПОИМЁННЫЕ МОЛИТВЫ: шаблон книги + собственный помянник → готовый текст.
//
// Личная ручка: имена берутся из помянника хозяина сессии, родительный падеж
// даёт словарь личных имён (@/lib/pomyannik/slavonic) — той же дорогой, что и
// записка, чтобы молитва и записка не разошлись в написании. Помянник пуст —
// отдаём общую формулу книги («родителей моих, сродников…»): молитва читается
// и так, о всех православных христианах вообще.
//
// Тексты — fixed_texts корпуса typikon-rules; какие издания можно отдать,
// решает @/lib/molitvoslov/rights (тот же набор, что показывает сайт;
// английский слой молитвослова в выгрузку не шёл — не отдаётся).
export const dynamic = "force-dynamic";

const GENDERS: PrayerGender[] = ["m", "f"];

export async function GET(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const forKind = readEnum(url, "for", NAMED_FOR_KINDS) as NamedFor | null;
    const style = readEnum(url, "style", Object.keys(NAMED_STYLES)) as NamedStyleKey | null;
    const lang = (readEnum(url, "lang", PRAYER_LANGS) ?? "cu_gr") as PrayerLang;
    const gender = (readEnum(url, "gender", GENDERS) ?? "m") as PrayerGender;

    if (!forKind) {
        return fail("bad_request", "Параметр for обязателен: living или departed");
    }
    if (!style) {
        return fail("bad_request",
            "Параметр style обязателен: " + Object.keys(NAMED_STYLES).join(", "));
    }
    const entries = NAMED_STYLES[style][forKind];
    if (!entries.length) {
        return fail("bad_request",
            `Стиль «${style}» поимённой молитвы для ${forKind === "living" ? "живых" : "усопших"} не бывает`);
    }

    try {
        const found = namedPrayerTexts(entries, lang, gender);
        if (!found) {
            return fail("corpus_unavailable", "Корпус богослужебных книг на этом сервере недоступен");
        }
        if (!found.prayers.length) {
            return fail("not_found", "Тексты этого стиля в корпусе не нашлись");
        }

        // Имена — свой помянник, разворот по for, не больше того, что кладут
        // в одну записку: больше — уже не молитва, а листание.
        const mine = await listPersons(access.userId);
        const chosen = mine.filter(person => person.kind === forKind).slice(0, MAX_NAMES_IN_NOTE);
        const forms = await slavonicNames(chosen.map(p => p.churchName || p.name));
        const persons: NamedPerson[] = chosen.map(p => {
            const form = forms[p.churchName || p.name];
            return { name: form?.genitive ?? p.name, rank: p.rank, sex: p.sex };
        });

        return respondPrivate({
            for: forKind,
            style,
            lang: found.lang,
            gender,
            prayers: found.prayers.map(prayer => namedPrayer({
                ...prayer,
                text: renderNamedPrayer(prayer.text, persons, gender),
            })),
        }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/prayer-text/route#GET", source: "api" });
        return fail("internal", "Не удалось собрать молитву");
    }
}
