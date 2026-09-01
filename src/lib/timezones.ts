// ЧАСОВОЙ ПОЯС ХРАМА.
//
// Подписному календарю без него нельзя: служба в девять утра — это девять по
// местному, и прихожанин в Иркутске, подписавшись, увидел бы её в четыре.
// Пояса у нас не было вовсе — всем стояла Москва.
//
// ВЫВОДИМ ДОГАДКОЙ, А НЕ ЗНАНИЕМ, и говорим об этом вслух. Для большинства
// стран догадка точна: пояс в них один, и ошибиться негде. Для России —
// приблизительна: границы поясов идут по границам областей, а не по
// меридианам, и всякая пограничная область ляжет не туда. Приход поправит —
// он один и знает, что у него не как у соседей.

/** Страны, где пояс один. Здесь догадка — не догадка, а факт. */
const ONE_ZONE: Record<string, string> = {
    RO: "Europe/Bucharest", GR: "Europe/Athens", UA: "Europe/Kyiv",
    GE: "Asia/Tbilisi", BY: "Europe/Minsk", BG: "Europe/Sofia",
    RS: "Europe/Belgrade", MK: "Europe/Skopje", ME: "Europe/Podgorica",
    BA: "Europe/Sarajevo", HR: "Europe/Zagreb", SI: "Europe/Ljubljana",
    SK: "Europe/Bratislava", CZ: "Europe/Prague", PL: "Europe/Warsaw",
    HU: "Europe/Budapest", AT: "Europe/Vienna", DE: "Europe/Berlin",
    CH: "Europe/Zurich", IT: "Europe/Rome", FR: "Europe/Paris",
    NL: "Europe/Amsterdam", BE: "Europe/Brussels", SE: "Europe/Stockholm",
    NO: "Europe/Oslo", DK: "Europe/Copenhagen", FI: "Europe/Helsinki",
    EE: "Europe/Tallinn", LV: "Europe/Riga", LT: "Europe/Vilnius",
    MD: "Europe/Chisinau", AL: "Europe/Tirane", CY: "Asia/Nicosia",
    TR: "Europe/Istanbul", AM: "Asia/Yerevan", AZ: "Asia/Baku",
    IL: "Asia/Jerusalem", ET: "Africa/Addis_Ababa", ER: "Africa/Asmara",
    EG: "Africa/Cairo", GB: "Europe/London", IE: "Europe/Dublin",
    KZ: "Asia/Almaty", KG: "Asia/Bishkek", UZ: "Asia/Tashkent",
    TJ: "Asia/Dushanbe", TM: "Asia/Ashgabat",
};

/**
 * Россия — по долготе, и это ПРИБЛИЖЕНИЕ.
 *
 * Пояса здесь назначены по областям: Волгоград на сорок пятом градусе живёт
 * по Москве, а Самара на пятидесятом — на час впереди, и никакая линия по
 * карте этого не покажет. Числа ниже — середины, а не границы: они попадают
 * в цель почти везде и мимо у пограничных. Оттого догадка и помечается
 * догадкой.
 */
const RU_BANDS: [number, string][] = [
    [23, "Europe/Kaliningrad"], [47, "Europe/Moscow"], [53, "Europe/Samara"],
    [68, "Asia/Yekaterinburg"], [76, "Asia/Omsk"], [92, "Asia/Novosibirsk"],
    [108, "Asia/Irkutsk"], [126, "Asia/Yakutsk"], [140, "Asia/Vladivostok"],
    [158, "Asia/Magadan"], [999, "Asia/Kamchatka"],
];

export interface TimezoneGuess {
    tz: string | null;
    /** Точно ли. `country` — пояс в стране один; `longitude` — по долготе. */
    how: "country" | "longitude" | null;
}

export const guessTimezone = (
    country: string | null | undefined, longitude: number | null | undefined,
): TimezoneGuess => {
    if (country && ONE_ZONE[country]) return { tz: ONE_ZONE[country], how: "country" };
    if (country === "RU" && typeof longitude === "number") {
        const band = RU_BANDS.find(([edge]) => longitude < edge);
        return { tz: band ? band[1] : "Europe/Moscow", how: "longitude" };
    }
    return { tz: null, how: null };
};

// ── VTIMEZONE ────────────────────────────────────────────────────────────
//
// TZID без объявления Apple Calendar и Outlook кладут не туда: имя пояса им
// ни о чём не говорит, если в файле нет правила перехода. Оттого объявления
// перечислены здесь.
//
// Правил ровно два, и в этом всё дело. Россия с 2014 года летнего времени не
// знает — у неё один STANDARD в шесть строк. Европа переходит по общему
// правилу: последнее воскресенье марта и октября, и правило это одно на все
// её пояса, отличаясь лишь сдвигом.

interface Zone { std: number; dst?: number; stdName: string; dstName?: string }

const OFF = (h: number) => `${h < 0 ? "-" : "+"}${String(Math.abs(h)).padStart(2, "0")}00`;

const EU = (std: number, stdName: string, dstName: string): Zone =>
    ({ std, dst: std + 1, stdName, dstName });

export const ZONES: Record<string, Zone> = {
    // Россия — без перехода
    "Europe/Kaliningrad": { std: 2, stdName: "EET" },
    "Europe/Moscow": { std: 3, stdName: "MSK" },
    "Europe/Simferopol": { std: 3, stdName: "MSK" },
    "Europe/Volgograd": { std: 3, stdName: "MSK" },
    "Europe/Kirov": { std: 3, stdName: "MSK" },
    "Europe/Samara": { std: 4, stdName: "+04" },
    "Europe/Astrakhan": { std: 4, stdName: "+04" },
    "Europe/Saratov": { std: 4, stdName: "+04" },
    "Europe/Ulyanovsk": { std: 4, stdName: "+04" },
    "Asia/Yekaterinburg": { std: 5, stdName: "+05" },
    "Asia/Omsk": { std: 6, stdName: "+06" },
    "Asia/Novosibirsk": { std: 7, stdName: "+07" },
    "Asia/Barnaul": { std: 7, stdName: "+07" },
    "Asia/Tomsk": { std: 7, stdName: "+07" },
    "Asia/Krasnoyarsk": { std: 7, stdName: "+07" },
    "Asia/Irkutsk": { std: 8, stdName: "+08" },
    "Asia/Chita": { std: 9, stdName: "+09" },
    "Asia/Yakutsk": { std: 9, stdName: "+09" },
    "Asia/Vladivostok": { std: 10, stdName: "+10" },
    "Asia/Magadan": { std: 11, stdName: "+11" },
    "Asia/Sakhalin": { std: 11, stdName: "+11" },
    "Asia/Kamchatka": { std: 12, stdName: "+12" },
    // Пояса без перехода вне России
    "Asia/Tbilisi": { std: 4, stdName: "+04" },
    "Asia/Yerevan": { std: 4, stdName: "+04" },
    "Asia/Baku": { std: 4, stdName: "+04" },
    "Africa/Addis_Ababa": { std: 3, stdName: "EAT" },
    "Africa/Asmara": { std: 3, stdName: "EAT" },
    "Europe/Istanbul": { std: 3, stdName: "+03" },
    "Europe/Minsk": { std: 3, stdName: "+03" },
    "Asia/Almaty": { std: 5, stdName: "+05" },
    "Asia/Bishkek": { std: 6, stdName: "+06" },
    "Asia/Tashkent": { std: 5, stdName: "+05" },
    "Asia/Dushanbe": { std: 5, stdName: "+05" },
    "Asia/Ashgabat": { std: 5, stdName: "+05" },
    // Европа — с переходом по общему правилу
    "Europe/Bucharest": EU(2, "EET", "EEST"),
    "Europe/Athens": EU(2, "EET", "EEST"),
    "Europe/Kyiv": EU(2, "EET", "EEST"),
    "Europe/Sofia": EU(2, "EET", "EEST"),
    "Europe/Chisinau": EU(2, "EET", "EEST"),
    "Europe/Helsinki": EU(2, "EET", "EEST"),
    "Europe/Tallinn": EU(2, "EET", "EEST"),
    "Europe/Riga": EU(2, "EET", "EEST"),
    "Europe/Vilnius": EU(2, "EET", "EEST"),
    "Asia/Nicosia": EU(2, "EET", "EEST"),
    "Europe/Belgrade": EU(1, "CET", "CEST"),
    "Europe/Skopje": EU(1, "CET", "CEST"),
    "Europe/Podgorica": EU(1, "CET", "CEST"),
    "Europe/Sarajevo": EU(1, "CET", "CEST"),
    "Europe/Zagreb": EU(1, "CET", "CEST"),
    "Europe/Ljubljana": EU(1, "CET", "CEST"),
    "Europe/Bratislava": EU(1, "CET", "CEST"),
    "Europe/Prague": EU(1, "CET", "CEST"),
    "Europe/Warsaw": EU(1, "CET", "CEST"),
    "Europe/Budapest": EU(1, "CET", "CEST"),
    "Europe/Vienna": EU(1, "CET", "CEST"),
    "Europe/Berlin": EU(1, "CET", "CEST"),
    "Europe/Zurich": EU(1, "CET", "CEST"),
    "Europe/Rome": EU(1, "CET", "CEST"),
    "Europe/Paris": EU(1, "CET", "CEST"),
    "Europe/Amsterdam": EU(1, "CET", "CEST"),
    "Europe/Brussels": EU(1, "CET", "CEST"),
    "Europe/Stockholm": EU(1, "CET", "CEST"),
    "Europe/Oslo": EU(1, "CET", "CEST"),
    "Europe/Copenhagen": EU(1, "CET", "CEST"),
    "Europe/Tirane": EU(1, "CET", "CEST"),
    "Europe/London": EU(0, "GMT", "BST"),
    "Europe/Dublin": EU(0, "GMT", "IST"),
};

export const knownZone = (tz: string) => tz in ZONES;

/** Строки VTIMEZONE для календаря. Пустой список — пояса не знаем. */
export const vtimezoneLines = (tz: string): string[] => {
    const z = ZONES[tz];
    if (!z) return [];
    const out = ["BEGIN:VTIMEZONE", `TZID:${tz}`];
    if (z.dst === undefined) {
        out.push("BEGIN:STANDARD", "DTSTART:19700101T000000",
                 `TZOFFSETFROM:${OFF(z.std)}`, `TZOFFSETTO:${OFF(z.std)}`,
                 `TZNAME:${z.stdName}`, "END:STANDARD");
    } else {
        // Общее правило Евросоюза: переход в час ночи по Гринвичу, в последнее
        // воскресенье марта и октября. Одно на все европейские пояса
        out.push("BEGIN:DAYLIGHT", "DTSTART:19700329T020000",
                 "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
                 `TZOFFSETFROM:${OFF(z.std)}`, `TZOFFSETTO:${OFF(z.dst)}`,
                 `TZNAME:${z.dstName}`, "END:DAYLIGHT",
                 "BEGIN:STANDARD", "DTSTART:19701025T030000",
                 "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
                 `TZOFFSETFROM:${OFF(z.dst)}`, `TZOFFSETTO:${OFF(z.std)}`,
                 `TZNAME:${z.stdName}`, "END:STANDARD");
    }
    out.push("END:VTIMEZONE");
    return out;
};
