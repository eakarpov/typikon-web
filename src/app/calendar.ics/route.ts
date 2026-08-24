import { calcDay } from "@/lib/calcDay";
import { cached, CacheTag } from "@/lib/cache";
import { buildCalendar, CalendarEvent } from "@/lib/ical";
import { TextType, valueTitle } from "@/utils/texts";
import { DEFAULT_BIBLE_LANGUAGE } from "@/utils/bibleLanguage";

// Подписной календарь: чтения и памяти дня приезжают в тот календарь, которым человек
// уже пользуется, без захода на сайт и без приложения.
//
// Окно скользящее: неделя назад и три месяца вперёд. Календарные клиенты перечитывают
// ленту сами (Google — раз в несколько часов или реже), поэтому отдавать всю историю
// незачем, а вперёд нужно столько, чтобы человек видел ближайшие праздники.
//
// Пересобирается раз в сутки: содержимое дня меняется только правкой в админке.
// Параметров у ленты сознательно нет: любое чтение searchParams сделало бы маршрут
// динамическим, и каждый подписчик заново собирал бы сто дней. Без них Next держит
// готовый ответ и обновляет его в фоне.
export const revalidate = 86400;

const BASE_URL = "https://typikon.su";
const DAYS_BACK = 7;
const DAYS_AHEAD = 90;

// Расчёт дня — несколько запросов в базу и агрегация с lookup'ами, около полусекунды
// на дату. На окно в сто дней это минуты, поэтому результат кэшируется по паре
// (дата, язык) и сбрасывается тем же тегом, что и правки дней в админке.
const calcDayCached = cached(
    (dateStr: string, lang: string) => calcDay(dateStr, lang),
    ["calendar-ics-day"],
    [CacheTag.DAYS, CacheTag.TEXTS, CacheTag.SIGNS],
);

// Сколько дат считаем одновременно. Последовательно — слишком долго, все разом —
// незачем занимать весь пул соединений ради ленты, которая пересобирается раз в сутки.
const CONCURRENCY = 8;

const pad = (n: number) => String(n).padStart(2, "0");
const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toIcsDate = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

// Названия чтений по слотам дня — то же, что показывает страница /calculator/{дата}.
const readingsOf = (day: any): string[] => {
    const out: string[] = [];
    for (const type of Object.values(TextType)) {
        const slot = day?.[type];
        const names = (slot?.items ?? [])
            .map((item: any) => item?.text?.name)
            .filter(Boolean);
        if (names.length) out.push(`${valueTitle(type as TextType)}: ${names.join("; ")}`);
    }
    return out;
};

const buildEvent = (date: Date, result: any): CalendarEvent | null => {
    if (!result?.day) return null;

    const memories = result.memories;
    const main = memories?.default?.name;
    const dayName = result.day?.name;

    // Заголовок должен читаться в узкой строке календаря, поэтому только главное:
    // память дня и, если это подвижный день, его название.
    const summary = [main, dayName && dayName !== main ? dayName : null]
        .filter(Boolean)
        .join(" — ") || "Уставные чтения";

    const secondary = (memories?.secondary ?? []).map((m: any) => m.name).filter(Boolean);
    const readings = readingsOf(result.day);

    const description = [
        result.date ? `Число по старому стилю: ${new Date(result.date).toLocaleDateString("ru-RU")}` : null,
        secondary.length ? `Также память: ${secondary.join("; ")}` : null,
        readings.length ? "" : null,
        ...readings,
        "",
        `${BASE_URL}/calculator/${toIsoDate(date)}`,
    ].filter((part) => part !== null).join("\n");

    return {
        uid: `${toIcsDate(date)}@typikon.su`,
        date: toIcsDate(date),
        summary,
        description,
        url: `${BASE_URL}/calculator/${toIsoDate(date)}`,
    };
};

export async function GET() {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const dates: Date[] = [];
    for (let offset = -DAYS_BACK; offset <= DAYS_AHEAD; offset++) {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        dates.push(d);
    }

    const events: CalendarEvent[] = [];
    for (let i = 0; i < dates.length; i += CONCURRENCY) {
        const chunk = dates.slice(i, i + CONCURRENCY);
        const results = await Promise.all(chunk.map(async (date) => {
            try {
                const result = await calcDayCached(toIsoDate(date), DEFAULT_BIBLE_LANGUAGE);
                return buildEvent(date, result);
            } catch (e) {
                // Один сбойный день не должен обрушить всю ленту.
                console.error(`calendar.ics: не удалось посчитать ${toIsoDate(date)}`, e);
                return null;
            }
        }));
        for (const event of results) {
            if (event) events.push(event);
        }
    }

    const body = buildCalendar({
        name: "Уставные чтения",
        description: "Чтения и памяти дня по Типикону — typikon.su",
        events,
        stamp: new Date(),
    });

    return new Response(body, {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="typikon.ics"',
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
    });
}
