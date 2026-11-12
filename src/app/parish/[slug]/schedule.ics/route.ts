import {getTemple} from "@/lib/temples";
import {settingsFor} from "@/lib/parish/settings";
import {periodsBetween,periodKeyForDate} from "@/lib/parish/period";
import { buildCalendar, knownTimezone, type CalendarEvent } from "@/lib/ical";
import { parishView } from "@/lib/parish/schedule";
import { isoDate } from "@/lib/ordo";
import { ICS_UID_DOMAIN, SITE_HOST, SITE_URL } from "@/utils/site";
import { migrationEvent } from "@/lib/migration";

// ПОДПИСНОЙ КАЛЕНДАРЬ ПРИХОДА. Прихожанин подписывается телефоном один раз, и
// расписание приезжает в тот календарь, которым он уже пользуется, — без
// захода на сайт и без приложения.
//
// Отличается от ленты уставных чтений (/calendar.ics) тем, ради чего всё и
// затевалось: события здесь СО ВРЕМЕНЕМ. Суточное «сегодня Успение» человеку
// на службу не поможет — ему нужно «в девять тридцать».
//
// Едет ОПУБЛИКОВАННОЕ, если приход что-то опубликовал, и проект, если нет.
// Иначе вышло бы худшее: подписчик получил бы в телефон наш вывод, а на
// стенде висело бы другое — и разошлись бы они молча.
//
// Окно скользящее — от прошлой недели на три месяца вперёд, как у соседней
// ленты: календарные клиенты перечитывают её сами и редко, а вперёд нужно
// столько, чтобы человек видел ближайшие праздники.

export const revalidate = 3600;

const BASE_URL = SITE_URL;
const DAYS_BACK = 7;
const DAYS_AHEAD = 90;
const DEFAULT_MINUTES = 90;

const stamp = (date: string, time: string) =>
    `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

const plusMinutes = (date: string, time: string, minutes: number) => {
    const d = new Date(`${date}T${time}:00Z`);
    d.setUTCMinutes(d.getUTCMinutes() + minutes);
    return `${isoDate(d).replace(/-/g, "")}T`
        + `${String(d.getUTCHours()).padStart(2, "0")}`
        + `${String(d.getUTCMinutes()).padStart(2, "0")}00`;
};

export async function GET(_: Request, ctx: { params: Promise<{ slug: string }> }) {
    const { slug } = await ctx.params;

    const temple=await getTemple(slug);if(!temple)return new Response("нет такого прихода",{status:404});
    const settings=await settingsFor(temple);
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const from = new Date(today); from.setUTCDate(from.getUTCDate() - DAYS_BACK);
    const to = new Date(today); to.setUTCDate(to.getUTCDate() + DAYS_AHEAD);
    const [lo, hi] = [isoDate(from), isoDate(to)];

    const months = await Promise.all(
        periodsBetween(from,to,settings.schedulePeriod??"month").map(m => parishView(slug, m)));
    const first = months.find(Boolean);
    if (!first) {
        return new Response("нет такого прихода", { status: 404 });
    }

    // ПОЯС ПРИХОДА, а не Москва. Стояла Москва всем, и служба в девять утра
    // приезжала прихожанину в Иркутске на четыре часа раньше срока
    const tzid = first.timezone;
    const events: CalendarEvent[] = [];
    for (const month of months) {
        for (const day of month?.days ?? []) {
            if (day.date < lo || day.date > hi) continue;
            for (const g of day.gatherings) {
                // Собрание без часа в календарь не идёт: событие без времени
                // здесь — обещание, которого мы не давали
                if (!g.time) continue;
                events.push({
                    // Уид держится за собрание, а не за его место в дне: правка
                    // часа должна ПОДВИНУТЬ событие у подписчика, а не завести
                    // рядом второе
                    uid: `${g.key}@${slug}.${ICS_UID_DOMAIN}`,
                    start: stamp(g.civil, g.time),
                    end: plusMinutes(g.civil, g.time, g.duration ?? DEFAULT_MINUTES),
                    tzid,
                    summary: g.title + (g.belongsTo ? ` — ${g.belongsTo}` : ""),
                    description: [
                        day.triodLabel ?? day.memories[0]?.label ?? day.label,
                        day.prestolny ? "Престольный праздник" : null,
                        day.fastingLabel,
                        knownTimezone(tzid) ? null
                            : `Время указано по поясу ${tzid}, который календарь может не знать.`,
                        // ДОГАДКА НАЗЫВАЕТСЯ ДОГАДКОЙ: пояс, выведенный по
                        // долготе, у пограничных областей ошибается на час, и
                        // подписчик должен знать, что его никто не подтверждал
                        first.timezoneHow === "longitude"
                            ? `Часовой пояс (${tzid}) выведен по долготе и приходом не подтверждён.`
                            : null,
                        "",
                        `${BASE_URL}/parish/${slug}/schedule/${periodKeyForDate(day.date,settings.schedulePeriod??"month")}`,
                    ].filter(Boolean).join("\n"),
                    url: `${BASE_URL}/parish/${slug}/schedule/${periodKeyForDate(day.date,settings.schedulePeriod??"month")}`,
                    cancelled: g.cancelled,
                });
            }
        }
    }

    // ПЕРЕЕЗД (временно, до середины января): та же причина, что и в общей ленте.
    events.push(migrationEvent());

    const body = buildCalendar({
        name: `Богослужения: ${first.title}`,
        description: `Расписание богослужений. ${first.title} — ${SITE_HOST}`,
        events,
        stamp: new Date(),
        ttlHours: 6,
    });

    return new Response(body, {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `inline; filename="${slug}.ics"`,
            "Cache-Control": "public, max-age=1800, s-maxage=3600",
        },
    });
}
