import { authorize } from "@/lib/api/v2/access";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { readEnum } from "@/lib/api/v2/params";
import { posledovanieRow } from "@/lib/api/v2/serialize";
import type { PrayerGender } from "@/lib/molitvoslov/named";
import {
    POSLEDOVANIYE_KEYS, POSLEDOVANIYA, posledovanieTexts, PRAYER_LANGS, type PrayerLang,
} from "@/lib/molitvoslov/store";
import { reportError } from "@/lib/reportError";

// КЕЛЕЙНЫЕ ПОСЛЕДОВАНИЯ МОЛИТВОСЛОВА: утренние, на сон грядущим, ко
// Причащению и прочие — строками в порядке печати.
//
// Открытая зона calendar: тексты молитвослова сайт показывает публично, и
// ручка отдаёт ровно тот набор, что можно показать (см.
// @/lib/molitvoslov/rights): английский слой, чьи права не выяснены, молчит.
// Порядок и подписи — из вхождений корпуса (fixed_text_occurrences), а не из
// переписанной копии: разбор книги поправят — ручка скажет новое сама.
//
// Девять ключей покрыты полностью — у каждого есть вхождения в корпусе
// (сверено с parsed/molitvoslov и spec/registry/kelia-moments.yaml).
export const revalidate = 3600;

const GENDERS: PrayerGender[] = ["m", "f"];

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const key = url.searchParams.get("key") ?? "";
    const lang = (readEnum(url, "lang", PRAYER_LANGS) ?? "cu_gr") as PrayerLang;
    const gender = (readEnum(url, "gender", GENDERS) ?? "m") as PrayerGender;

    if (!POSLEDOVANIYE_KEYS.includes(key)) {
        return fail("bad_request", "Такого последования нет: " + (key || "пустой ключ"));
    }

    try {
        const found = posledovanieTexts(POSLEDOVANIYA[key], lang, gender);
        if (!found) {
            return fail("corpus_unavailable", "Корпус богослужебных книг на этом сервере недоступен");
        }
        if (!found.rows.length) {
            return fail("not_found", "Этого последования в корпусе пока нет");
        }
        return respond({
            key,
            lang: found.lang,
            rows: found.rows.map(posledovanieRow),
        }, { access, maxAge: revalidate });
    } catch (e) {
        reportError(e, { where: "app/api/v2/posledovanie/route#GET", source: "api" });
        return fail("internal", "Не удалось открыть последование");
    }
}
