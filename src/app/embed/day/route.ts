import { NextRequest, NextResponse } from "next/server";
import { calcDayCached } from "@/lib/api/v2/calendar";
import { DAY_SLOT_ORDER, TextType, valueTitle } from "@/utils/texts";
import { MONTH_OF } from "@/utils/chantLabels";
import { formatDateISO } from "@/utils/dates";
import { readOptions, renderEmbed, type EmbedDay, type EmbedReading } from "@/lib/embed/day";

// Виджет чтений для чужого сайта: `<iframe src="…/embed/day">`.
//
// Ручка, а не страница: у страницы был бы общий макет сайта — шапка, разметка,
// бандл, — а виджету нужен документ в несколько килобайт. Заодно снимается
// вопрос о стилях: наружу уходит только то, что здесь написано.
//
// Считается тем же путём, что и публичное API календаря (`calcDayCached`), —
// один кэш на двоих, и виджет не заводит движку лишней работы.

export const revalidate = 600;

const BASE = "https://www.typikon.su";

const dateLabel = (iso: string): string => {
    const [y, m, d] = iso.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("ru-RU", {
        weekday: "long", timeZone: "UTC",
    });
    return `${d} ${MONTH_OF[m]} ${y}, ${weekday}`;
};

const churchLabel = (raw: unknown): string | null => {
    if (!raw) return null;
    const d = new Date(raw as string);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getUTCDate()} ${MONTH_OF[d.getUTCMonth() + 1]} ст. ст.`;
};

/** Строки чтений: слот, а в нём цитаты со ссылкой на сам текст, если она есть. */
const readingsOf = (day: any): EmbedReading[] =>
    (DAY_SLOT_ORDER as readonly string[])
        .filter(slot => day?.[slot]?.items?.length)
        .map(slot => ({
            slot: valueTitle(slot as TextType),
            cites: day[slot].items.map((item: any) => ({
                cite: item.cite || item.pericope?.label || item.text?.name || "",
                alias: item.text?.alias || item.pericope?.textAlias || null,
                // Библейским считаем то, за чем стоит зачало: по нему и
                // отбирают, когда просят «только чтения из Писания».
                bible: Boolean(item.pericope),
            })).filter((c: { cite: string }) => c.cite),
        }))
        .filter(reading => reading.cites.length);

export async function GET(request: NextRequest) {
    const options = readOptions(request.nextUrl.searchParams, formatDateISO(new Date()));

    let day: EmbedDay | null = null;
    try {
        const result: any = await calcDayCached(options.date, options.lang);
        if (result) {
            day = {
                dateLabel: dateLabel(options.date),
                churchLabel: churchLabel(result.date),
                dayName: result.day?.name || null,
                memories: [
                    ...(result.memories?.default ? [result.memories.default] : []),
                    ...(result.memories?.secondary ?? []),
                ].map((m: any) => ({ name: m?.name ?? "", sign: m?.sign ?? null }))
                    .filter(m => m.name),
                readings: readingsOf(result.day),
            };
        }
    } catch (e) {
        // Виджет стоит на чужом сайте: пятисотка там выглядит поломкой этого
        // сайта. Отдаём рамку с честной строкой и кодом 200.
        console.error("embed: не удалось рассчитать день", e);
    }

    // Названный день не меняется никогда, сегодняшний — меняется в полночь.
    // Час кэша на «сегодня» означал бы, что в начале суток приход показывает
    // вчерашние чтения; десять минут этого не допустят и нагрузки не создадут.
    const fixed = request.nextUrl.searchParams.get("date");
    const maxAge = fixed ? 86400 : 600;

    return new NextResponse(renderEmbed(day, options, BASE), {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            // Ради этого всё и затевалось — рамку встраивают у себя. Пишем
            // явно, чтобы общий запрет кадров, если он когда-нибудь появится,
            // не выключил виджет молча.
            "Content-Security-Policy": "frame-ancestors *",
            "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}`,
            "X-Robots-Tag": "noindex",
        },
    });
}
