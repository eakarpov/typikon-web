import { personalDate, fullDate } from "./dates";
import { TEMPORARY_RANKS, statusRank, temporaryRank } from "./marks";
import { MAX_PERSONS, RANK_BY_KEY, type PomyannikPerson, type NameDay } from "./types";

export const MAX_BACKUP_MB = 64;
export const MAX_BACKUP_BYTES = MAX_BACKUP_MB * 1024 * 1024;
export type BackupPerson = Pick<PomyannikPerson, "name" | "churchName" | "kind" | "sex" | "rank" | "mark" | "rankUntil" | "relation" | "born" | "baptized" | "died" | "nameDay" | "sorokoust" | "groups"> & { signature: string | null };
export interface PomyannikBackup {
    format: "typikon-pomyannik";
    version: 2;
    exportedAt: string;
    persons: BackupPerson[];
}
export class BackupError extends Error {}

const object = (raw: unknown): Record<string, unknown> => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BackupError("Ожидалась карточка человека.");
    return raw as Record<string, unknown>;
};
const text = (raw: unknown, max: number): string | null => {
    if (raw == null || raw === "") return null;
    if (typeof raw !== "string" || raw.length > max || /[\u0000-\u001f]/.test(raw)) throw new BackupError("Недопустимый текст или превышена длина поля.");
    return raw;
};
const date = (raw: unknown, exact = false): string | null => {
    const value = text(raw, 10);
    if (value === null) return null;
    if (!(exact ? fullDate(value) : personalDate(value))) throw new BackupError("Некорректная дата.");
    return value;
};
const nameDay = (raw: unknown): NameDay | null => {
    if (raw == null) return null;
    const value = object(raw);
    if (value.source !== "auto" && value.source !== "manual") throw new BackupError("Неизвестный источник именин.");
    const common = { source: value.source, saint: text(value.saint, 200) };
    if (value.offset != null) {
        if (!Number.isInteger(value.offset) || Math.abs(Number(value.offset)) > 200) throw new BackupError("Некорректная подвижная память.");
        return { ...common, offset: Number(value.offset) } as NameDay;
    }
    if (value.style != null && value.style !== "old" && value.style !== "new") throw new BackupError("Неизвестный стиль календаря.");
    const m = Number(value.month), d = Number(value.day);
    if (!Number.isInteger(value.month) || !Number.isInteger(value.day) || m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(2000, m, 0)).getUTCDate()) throw new BackupError("Некорректный день именин.");
    return { ...common, ...(value.style ? { style: value.style } : {}), month: m, day: d } as NameDay;
};

/** Только переносимые поля: чужие id, userId, служебные поля и произвольные ключи не принимаются. */
export const backupPerson = (raw: unknown): BackupPerson => {
    const value = object(raw);
    const name = text(value.name, 60);
    if (!name?.trim() || !/[\p{L}]/u.test(name)) throw new BackupError("Не указано имя.");
    if (value.kind !== "living" && value.kind !== "departed") throw new BackupError("Не указан раздел помянника.");
    if (value.sex != null && value.sex !== "m" && value.sex !== "f") throw new BackupError("Некорректный род.");
    if (value.mark != null && !TEMPORARY_RANKS.includes(value.mark as PomyannikPerson["rank"] & string)) throw new BackupError("Неизвестная временная помета.");
    if (value.rank != null && (typeof value.rank !== "string" || !Object.hasOwn(RANK_BY_KEY, value.rank))) throw new BackupError("Неизвестный чин или помета.");
    if (value.rankUntil != null && (!(value.mark ?? value.rank) || !TEMPORARY_RANKS.some(rank => rank === (value.mark ?? value.rank)))) throw new BackupError("Срок задан для постоянного чина.");
    const groups = value.groups ?? [];
    if (!Array.isArray(groups) || groups.length > 10 || groups.some(g => !text(g, 40)?.trim())) throw new BackupError("Некорректные группы.");
    const died = date(value.died);
    if (died && value.kind !== "departed") throw new BackupError("Дата преставления указана в разделе о здравии.");
    let sorokoust = null;
    if (value.sorokoust != null) {
        const span = object(value.sorokoust);
        const from = date(span.from, true);
        if (!from) throw new BackupError("Не указано начало сорокоуста.");
        sorokoust = { from, where: text(span.where, 120) };
    }
    return {
        name, churchName: text(value.churchName, 60), kind: value.kind, sex: value.sex ?? null,
        ...(value.mark !== undefined ? { mark: value.mark as PomyannikPerson["rank"] } : {}),
        rank: value.rank ?? null, rankUntil: date(value.rankUntil, true), relation: text(value.relation, 60), signature: text(value.signature, 120),
        born: date(value.born), baptized: date(value.baptized), died,
        nameDay: nameDay(value.nameDay), sorokoust, groups: [...groups],
    } as BackupPerson;
};

export const makeBackup = (persons: PomyannikPerson[], now = new Date()): PomyannikBackup => ({
    format: "typikon-pomyannik", version: 2, exportedAt: now.toISOString(), persons: persons.map(backupPerson),
});

export const parseBackup = (raw: unknown): PomyannikBackup => {
    const value = object(raw);
    if (value.format !== "typikon-pomyannik" || (value.version !== 1 && value.version !== 2)) throw new BackupError("Это не резервная копия помянника поддерживаемой версии.");
    if (!Array.isArray(value.persons) || value.persons.length > MAX_PERSONS) throw new BackupError(`В файле должно быть не больше ${MAX_PERSONS} имён.`);
    return { format: "typikon-pomyannik", version: 2, exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : "", persons: value.persons.map((person, index) => {
        try { return backupPerson(person); }
        catch (e) { throw new BackupError(`Запись ${index + 1}: ${e instanceof Error ? e.message : "ошибка данных"}`); }
    }) };
};

/** Совпадения считаются с кратностью: две одинаковые карточки не превращаются в одну. */
export const planRestore = (current: PomyannikPerson[], incoming: BackupPerson[]) => {
    const identity = (raw: unknown) => {const p=backupPerson(raw);const {rank:_rank,mark:_mark,...rest}=p;return JSON.stringify({...rest, rank:statusRank(p),mark:temporaryRank(p)});};
    const counts = new Map<string, number>();
    for (const person of current) {
        const key = identity(person);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const additions = incoming.filter(person => {
        const key = identity(person);
        const count = counts.get(key) ?? 0;
        if (!count) return true;
        counts.set(key, count - 1);
        return false;
    });
    return { additions, skipped: incoming.length - additions.length };
};
