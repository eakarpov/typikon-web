import { getItem } from "@/app/profile/api";
import { getFavourites } from "@/app/api/favourites/service";
import { getAllUserNotes } from "@/app/api/user-notes/service";
import { listPersons } from "@/lib/pomyannik/service";
import { upcoming, type UpcomingEvent } from "@/lib/pomyannik/reckoning";
import { commemoratorOf } from "@/lib/pomyannik/commemorators";
import { countUnread } from "@/lib/pomyannik/zapiski";
import { keyOf, nameEntry } from "@/lib/imeniny/store";
import { templesOf } from "@/lib/parish/access";
import { nameDaysAhead, type NameDayAhead } from "@/lib/personal/nameDays";
import { recentProgress, type ProgressRow } from "@/lib/personal/progressService";
import { reportError } from "@/lib/reportError";

// СЕГОДНЯ ДЛЯ МЕНЯ — сборка.
//
// Всё, что здесь собирается, у сайта уже было: помянник, избранное, заметки,
// указатель имён, приходы. Не было одного — места, где это стоит вместе и
// вокруг человека, а не вокруг раздела. Новое здесь только место чтения.
//
// КАЖДАЯ ЧАСТЬ ПАДАЕТ ОТДЕЛЬНО. Страница собрана из шести независимых
// источников, и отказ одного — не повод не показать остальные: помянник не
// должен пропадать оттого, что не ответил указатель имён. Упавшая часть
// возвращается пустой и пишется в лог.

/** Окно «ближайшего»: две недели — срок, на который ещё строят планы. */
export const AHEAD_DAYS = 14;

export interface PersonalToday {
    date: string;
    userName: string | null;
    progress: ProgressRow[];
    /** События помянника: сегодняшние и ближайшие вместе, по порядку дат. */
    events: UpcomingEvent[];
    personsCount: number;
    /** Памяти святых с именем пользователя в окне. */
    nameDays: NameDayAhead[];
    /** Имя из профиля есть, но в указателе его нет. */
    nameUnknown: boolean;
    favourites: Array<{ textId: string; textName: string | null }>;
    favouritesCount: number;
    notes: Array<{ id: string; textId: string; textName: string | null; note: string }>;
    notesCount: number;
    temples: Array<{ slug: string }>;
    /** Непрочитанные записки — только у того, кто их принимает. */
    unreadZapiski: number | null;
}

const safe = async <T>(where: string, fallback: T, run: () => Promise<T>): Promise<T> => {
    try {
        return await run();
    } catch (e) {
        reportError(e, { where: `lib/personal/today#${where}` });
        return fallback;
    }
};

export const personalToday = async (userId: string, date: string): Promise<PersonalToday> => {
    const [userTuple, progress, persons, favourites, notes, temples, commemorator] = await Promise.all([
        safe("user", [null, null] as [any, any], () => getItem(userId)),
        safe("progress", [] as ProgressRow[], () => recentProgress(userId, 3)),
        safe("persons", [], () => listPersons(userId)),
        safe("favourites", [], () => getFavourites(userId)),
        safe("notes", [] as any[], () => getAllUserNotes(userId)),
        safe("temples", [] as any[], () => templesOf(userId)),
        safe("commemorator", null as any, () => commemoratorOf(userId)),
    ]);

    const userName = (userTuple?.[0]?.name as string | undefined)?.trim() || null;
    const key = userName ? keyOf(userName) : null;
    const [entry, unreadZapiski] = await Promise.all([
        safe("name", null, async () => (key ? nameEntry(key) : null)),
        safe("zapiski", null as number | null, async () => (commemorator ? countUnread(userId) : null)),
    ]);

    return {
        date,
        userName,
        progress,
        // Дата передаётся явно: `upcoming` без неё берёт часы процесса, а у
        // читателя во Владивостоке уже завтра.
        events: upcoming(persons, date, AHEAD_DAYS),
        personsCount: persons.length,
        nameDays: nameDaysAhead(entry, date, AHEAD_DAYS),
        nameUnknown: !!userName && !entry,
        favourites: favourites.slice(0, 5).map((f: any) => ({ textId: f.textId, textName: f.textName })),
        favouritesCount: favourites.length,
        notes: notes.slice(0, 3).map((n: any) => ({
            id: String(n.id), textId: n.textId, textName: n.textName ?? null, note: String(n.note ?? ""),
        })),
        notesCount: notes.length,
        temples: temples.map((t: any) => ({ slug: t.templeSlug as string })),
        unreadZapiski,
    };
};
