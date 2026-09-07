import {
    MAX_NAMES_IN_NOTE, NOTE_KIND_BY_KEY,
    type NoteKind, type PersonKind, type Rank, type Sex,
} from "@/lib/pomyannik/types";

// ПРАВИЛА ЗАПИСКИ — без базы и без сессии, чтобы их можно было проверить сами
// по себе. Тот же приём, что у lib/favourites: разбор и пределы отдельно от
// службы, которая ходит в Mongo.

export interface NoteName {
    /** Как написано у подавшего. */
    name: string;
    /** Церковное имя, если оно другое. */
    churchName: string | null;
    /** Церковнославянское начертание в родительном падеже. */
    slavonic: string | null;
    /**
     * Откуда взялось славянское написание: `lexicon` — склонено по словарю,
     * прочее — не склонено. Священник должен видеть это, а не гадать.
     */
    slavonicSource: "lexicon" | "accents" | "plain" | null;
    kind: PersonKind;
    rank: Rank | null;
    sex: Sex;
}

export class NoteError extends Error {}

/**
 * ИМЕНА В ЗАПИСКЕ — СНИМОК, А НЕ ССЫЛКИ НА ПОМЯННИК.
 *
 * Подавший потом правит свой список — переименует, поправит дату, уберёт имя, —
 * а поданное меняться не должно: священник принял то, что ему подали, и
 * подменять это задним числом нельзя ни ему во вред, ни подавшему во благо.
 */
export const snapshot = (
    person: {
        name: string; churchName?: string | null; kind: PersonKind;
        rank?: Rank | null; sex?: Sex;
    },
    slavonic?: { genitive: string; source: "lexicon" | "accents" | "plain" } | null,
): NoteName => ({
    name: String(person.name ?? "").trim().slice(0, 60),
    churchName: person.churchName ? String(person.churchName).trim().slice(0, 60) : null,
    slavonic: slavonic?.genitive ?? null,
    slavonicSource: slavonic?.source ?? null,
    kind: person.kind === "departed" ? "departed" : "living",
    rank: person.rank ?? null,
    sex: person.sex ?? null,
});

/**
 * Годится ли записка к подаче.
 *
 * ПАНИХИДА О ЖИВЫХ НЕ СЛУЖИТСЯ, И МОЛЕБЕН ОБ УСОПШИХ — ТОЖЕ. Это не придирка к
 * форме, а ровно та ошибка, ради которой записку и разбирают у свечного ящика;
 * дома разбирать её некому, и записка уйдёт священнику как есть.
 */
export const validateNote = (kind: string, names: NoteName[]): NoteName[] => {
    const info = NOTE_KIND_BY_KEY[kind];
    if (!info) throw new NoteError("такого поминовения мы не знаем");

    const clean = names.filter(n => n.name);
    if (!clean.length) throw new NoteError("в записке нет ни одного имени");
    if (clean.length > MAX_NAMES_IN_NOTE) {
        throw new NoteError(`в одну записку кладут не больше ${MAX_NAMES_IN_NOTE} имён`);
    }

    if (info.about !== "both") {
        const wrong = clean.filter(n => n.kind !== info.about);
        if (wrong.length) {
            throw new NoteError(info.about === "departed"
                ? `${info.label} — заупокойное поминовение, живых в него не вписывают: `
                  + wrong.map(n => n.churchName || n.name).join(", ")
                : `${info.label} служится о здравии, усопших в него не вписывают: `
                  + wrong.map(n => n.churchName || n.name).join(", "));
        }
    }

    return clean;
};

const DAY_MS = 24 * 3600 * 1000;

/** Срок длящегося поминовения: сорокоуст, полугодие, год, псалтирь. */
export const spanOf = (kind: NoteKind, from: Date): { from: string; to: string } | null => {
    const info = NOTE_KIND_BY_KEY[kind];
    if (!info?.days) return null;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    // День подачи — первый, как и день преставления: счёт везде один.
    return { from: iso(from), to: iso(new Date(+from + (info.days - 1) * DAY_MS)) };
};

/** Разовую держим три месяца, если её так и не открыли. */
export const UNREAD_DAYS = 90;
/** И тридцать дней после того, как прочли или как вышел срок. */
export const AFTER_DAYS = 30;

/**
 * Когда записку пора стереть.
 *
 * В ней ИМЕНА ТРЕТЬИХ ЛИЦ — людей, которые этого сайта не выбирали и о нём не
 * знают, — и держать их вечно не за что. У подавшего они и так лежат в
 * помяннике; священнику после поминовения они не нужны.
 *
 * Непрочитанная тоже стирается: священник, забывший про ящик, иначе копил бы
 * чужие имена годами, никого ими не помянув.
 */
export const expiresAt = (note: {
    createdAt: Date; readAt?: Date | null; span?: { to: string } | null;
}): Date => {
    if (note.span) {
        return new Date(+new Date(`${note.span.to}T12:00:00Z`) + AFTER_DAYS * DAY_MS);
    }
    if (note.readAt) return new Date(+new Date(note.readAt) + AFTER_DAYS * DAY_MS);
    return new Date(+new Date(note.createdAt) + UNREAD_DAYS * DAY_MS);
};
