import { cleanManualCase } from "./nameForms";
import { cleanCommemorationSuffix } from "./suffix";
import { ensureGroupMigration, listGroups, createGroup, assertOwnGroups } from "./groupsService";
import { groupIds, GroupError } from "./groups";
import { readCommemorations, validateCommemorations, CommemorationError, type CommemorationSettings } from "./commemoration";
import { moveToTrash, recoverFromTrash, TrashLimitError } from "./trash";
import { personalDate, fullDate, dateParts } from "./dates";
import { TEMPORARY_RANKS } from "./marks";
import { BackupError, parseBackup, planRestore } from "./backup";
import type { ReadingPlace } from "./reader";
import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { nameKey, normalizeName } from "@/lib/imeniny/core";
import { autoNameDay } from "@/lib/pomyannik/nameday";
import { cleanSignature, validPersonOrder } from "./organization";
import { guessSex } from "@/lib/pomyannik/names";
import {
    MAX_BATCH, MAX_PERSONS, RANK_BY_KEY,
    type NameDay, type PersonInput, type PomyannikPerson,
} from "@/lib/pomyannik/types";

// ПОМЯННИК В БАЗЕ.
//
// Живёт в `typikon-users`, как и всё личное, — и не по привычке, а потому что
// выкладка везёт базу `typikon` с ключом `--drop` (объяснено в lib/parish/db).
// Помянник, положенный туда, стёрся бы первой же выкладкой.
//
// ХОЗЯИН — В ФИЛЬТРЕ, А НЕ В ПРОВЕРКЕ ПОСЛЕ. Всякий запрос сюда несёт userId
// внутри условия, и чужую запись нельзя ни прочесть, ни поправить, ни удалить
// даже по угаданному идентификатору. Приём этот взят у lib/api user-notes и
// здесь важнее прежнего: там были заметки к тексту, тут — имена родни.

const COLLECTION = "pomyannikPersons";
const FEEDS = "pomyannikFeeds";

const persons = async () =>
    (await clientPromise).db("typikon-users").collection(COLLECTION);

const feeds = async () =>
    (await clientPromise).db("typikon-users").collection(FEEDS);

export class PersonDataError extends Error {}

export class TooManyPersonsError extends Error {
    constructor(readonly limit: number) {
        super(`в помяннике не больше ${limit} имён`);
    }
}

const isoDate = (raw: unknown): string | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw ?? ""));
    if (!m) return null;
    const [, y, mo, d] = m;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), 12);
    if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
    // Год за пределами разумного — это описка, а не дата: сдвиг календарей мы
    // считаем верным для 1900–2099 (см. lib/imeniny/dates), дальше не идём.
    if (Number(y) < 1800 || Number(y) > 2099) return null;
    return `${y}-${mo}-${d}`;
};

const cleanNameDay = (raw: unknown): NameDay | null => {
    if (!raw || typeof raw !== "object") return null;
    const value = raw as Record<string, unknown>;
    const source = value.source === "auto" ? "auto" : "manual";
    const saint = typeof value.saint === "string" ? value.saint.slice(0, 200) : null;

    if (typeof value.offset === "number" && Number.isInteger(value.offset)
        && Math.abs(value.offset) <= 200) {
        return { source, offset: value.offset, saint };
    }
    const month = Number(value.month), day = Number(value.day);
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;
    return { source, style: value.style === "old" ? "old" : "new", month, day, saint };
};

/**
 * Что из присланного мы кладём в базу.
 *
 * Перечнем, а не россыпью: тело запроса приходит от клиента, и класть его в
 * документ как есть значило бы дать вписать в помянник любое поле — в том числе
 * чужой userId.
 */
const clean = (input: PersonInput) => {
    for (const key of ["born", "baptized", "died"] as const) {
        if (input[key] && !personalDate(input[key])) throw new PersonDataError("Некорректная дата: укажите точную дату, только год или день и месяц без года.");
    }
    if (input.mark != null && !TEMPORARY_RANKS.includes(input.mark)) throw new PersonDataError("Неизвестная временная помета.");
    if (input.rankUntil && (!fullDate(input.rankUntil) || !(input.mark ?? input.rank) || !TEMPORARY_RANKS.includes((input.mark ?? input.rank)!))) throw new PersonDataError("Срок можно задать только для временной пометы и полной датой.");
    let manualGenitive, manualDative;
    try { manualGenitive = cleanManualCase(input.manualGenitive); manualDative = cleanManualCase(input.manualDative); }
    catch (error) { throw new PersonDataError((error as Error).message); }
    let commemorationSuffix;
    try { commemorationSuffix = cleanCommemorationSuffix(input.commemorationSuffix); }
    catch (error) { throw new PersonDataError((error as Error).message); }
    const name = normalizeName(String(input.name ?? "")).slice(0, 60);
    const key = nameKey(name);
    if (!key) return null;

    const rank = typeof input.rank === "string" && RANK_BY_KEY[input.rank]
        ? input.rank : null;
    const kind = input.kind === "departed" ? "departed" : "living";
    const died = personalDate(input.died);

    let groups: string[];
    try { groups = groupIds(input.groups); } catch(e) { throw new PersonDataError((e as Error).message); }

    const sorokoustFrom = input.sorokoust ? isoDate(input.sorokoust.from) : null;

    return {
        name,
        nameKey: key,
        churchName: input.churchName ? normalizeName(String(input.churchName)).slice(0, 60) : null,
        // Дата преставления и раздел не могут расходиться: помянник тем и
        // устроен, что развороты разные, и усопший на живом развороте — не
        // помета, а ошибка, которая уйдёт в записку.
        kind: died ? "departed" : kind,
        // Пол не спрашивается отдельным вопросом: от него зависит только форма
        // чина — «болящего Николая», но «болящей Марии», — и догадка по
        // окончанию имени вернее пустоты, при которой чин читался бы мужским
        // родом у всех. Ошибётся она на Никите и Илии, и правится одним щелчком.
        sex: input.sex === "m" || input.sex === "f" ? input.sex : guessSex(name),
        rank,
        ...(input.mark !== undefined ? { mark: input.mark && TEMPORARY_RANKS.includes(input.mark) ? input.mark : null } : {}),
        rankUntil: (input.mark ?? rank) && TEMPORARY_RANKS.includes((input.mark ?? rank)!) ? fullDate(input.rankUntil) : null,
        relation: input.relation ? String(input.relation).trim().slice(0, 60) || null : null,
        signature: cleanSignature(input.signature),
        commemorationSuffix, manualGenitive, manualDative,
        born: personalDate(input.born),
        baptized: personalDate(input.baptized),
        died,
        nameDay: cleanNameDay(input.nameDay),
        sorokoust: sorokoustFrom
            ? { from: sorokoustFrom,
                where: input.sorokoust?.where
                    ? String(input.sorokoust.where).trim().slice(0, 120) || null : null }
            : null,
        groups,
    };
};

const out = (doc: any): PomyannikPerson => {
    const { _id, ...rest } = doc;
    return { ...rest, signature: rest.signature ?? null, groups: rest.groups ?? [], id: String(_id) } as PomyannikPerson;
};

/**
 * Именины досчитываются сами, но НЕ ПЕРЕБИВАЮТ названных человеком: посчитанное
 * несёт помету `auto`, и стоит человеку назвать свои именины, как расчёт
 * умолкает. Он же и не считает ничего без дня рождения — гадать не из чего.
 */
const withNameDay = async (doc: ReturnType<typeof clean>) => {
    if (!doc) return doc;
    if (doc.nameDay && doc.nameDay.source === "manual") return doc;
    if (!dateParts(doc.born)?.month) return { ...doc, nameDay: doc.nameDay?.source === "auto" ? null : doc.nameDay };
    const auto = await autoNameDay(doc.churchName || doc.name, doc.born);
    return { ...doc, nameDay: auto ?? doc.nameDay ?? null };
};

export const listPersons = async (userId: string): Promise<PomyannikPerson[]> => {
    await ensureGroupMigration(userId);
    const docs = await (await persons())
        .find({ userId, deletedAt: null })
        .sort({ kind: 1, order: 1, name: 1 })
        .toArray();
    return decorateGroups(userId, docs.map(out));
};

const decorateGroups = async (userId:string, docs:PomyannikPerson[]) => {
    const names=new Map((await listGroups(userId)).map(g=>[g.id,g.name]));
    return docs.map(p=>({...p,groupNames:p.groups.map(id=>names.get(id)).filter((name):name is string=>!!name)}));
};
const checkGroups = async(userId:string,raw:unknown) => {
    try { return await assertOwnGroups(userId,raw); } catch(e) { if(e instanceof GroupError)throw new PersonDataError(e.message);throw e; }
};

export const countPersons = async (userId: string): Promise<number> =>
    (await persons()).countDocuments({ userId, deletedAt: null });

export const getPerson = async (userId: string, id: string): Promise<PomyannikPerson | null> => {
    if (!ObjectId.isValid(id)) return null;
    await ensureGroupMigration(userId);
    const doc = await (await persons()).findOne({ _id: new ObjectId(id), userId, deletedAt: null });
    return doc ? (await decorateGroups(userId,[out(doc)]))[0] : null;
};

/**
 * Записать имена.
 *
 * Повторов не отсеиваем: двух Николаев в роду не редкость, и молча слить их
 * значило бы решить за человека, что один из них лишний. Показать повтор при
 * разборе — дело страницы, а не базы.
 */
export const addPersons = async (
    userId: string, inputs: PersonInput[],
): Promise<PomyannikPerson[]> => {
    if (inputs.length > MAX_BATCH) throw new PersonDataError(`За раз принимается не больше ${MAX_BATCH} имён.`);
    await ensureGroupMigration(userId);
    const groupSets = new Map(inputs.filter(input=>input.groups?.length).map(input=>[JSON.stringify(input.groups),input.groups]));
    for(const groups of groupSets.values())await checkGroups(userId,groups);
    const batch = inputs;
    const cleaned = (await Promise.all(batch.map(i => withNameDay(clean(i)))))
        .filter(Boolean) as Array<NonNullable<ReturnType<typeof clean>>>;
    if (!cleaned.length) return [];

    const collection = await persons();
    const already = await collection.countDocuments({ userId, deletedAt: null });
    if (already + cleaned.length > MAX_PERSONS) throw new TooManyPersonsError(MAX_PERSONS);

    const last = await collection.find({ userId, deletedAt: null }).sort({ order: -1 }).limit(1).toArray();
    let order = (last[0]?.order ?? 0) + 1;

    const now = new Date();
    const docs = cleaned.map(doc => ({ ...doc, groupsSchemaVersion:1, userId, order: order++, createdAt: now, updatedAt: now }));
    const result = await collection.insertMany(docs as any[]);

    return decorateGroups(userId, docs.map((doc, i) => out({ ...doc, _id: result.insertedIds[i] })));
};

export const updatePerson = async (
    userId: string, id: string, patch: PersonInput,
): Promise<PomyannikPerson | null> => {
    if (!ObjectId.isValid(id)) return null;
    await ensureGroupMigration(userId);
    if(patch.groups!==undefined)await checkGroups(userId,patch.groups);
    const collection = await persons();
    const current = await collection.findOne({ _id: new ObjectId(id), userId, deletedAt: null });
    if (!current) return null;

    // Правка приходит целым лицом, а не по полю: иначе пришлось бы решать, что
    // значит отсутствующее поле — «не трогай» или «сотри», — и на этом вопросе
    // рано или поздно кто-нибудь потеряет дату преставления.
    const doc = await withNameDay(clean({ ...(current as any), ...patch, name: patch.name ?? current.name }));
    if (!doc) return null;

    await collection.updateOne(
        { _id: new ObjectId(id), userId, deletedAt: null },
        { $set: { ...doc, updatedAt: new Date() } },
    );
    return (await decorateGroups(userId,[out({ ...current, ...doc, _id: current._id })]))[0];
};

export const deletePerson = async (userId: string, id: string): Promise<boolean> =>
    moveToTrash(await persons(), userId, id);

/** Корзина хранится до восстановления; автоматического удаления нет. */
export const listTrash = async (userId: string): Promise<PomyannikPerson[]> => {
    await ensureGroupMigration(userId);
    return decorateGroups(userId, (await (await persons()).find({ userId, deletedAt: { $type: "date" } }).sort({ deletedAt: -1 }).toArray()).map(out));
};

export const restoreDeletedPerson = async (userId: string, id: string): Promise<boolean> => {
    await ensureGroupMigration(userId);
    try { return await recoverFromTrash(await persons(), userId, id, MAX_PERSONS); }
    catch (e) {
        if (e instanceof TrashLimitError) throw new TooManyPersonsError(MAX_PERSONS);
        throw e;
    }
};

/** Меняет только порядок, не перезаписывая карточки устаревшими данными клиента. */
export const reorderPersons = async (userId: string, ids: unknown): Promise<boolean> => {
    const collection = await persons();
    const current = await collection.find({ userId, deletedAt: null }, { projection: { _id: 1, order: 1 } }).toArray();
    if (!validPersonOrder(ids, current.map(doc => String(doc._id)))) return false;
    if (!ids.length) return true;
    const orders = new Map(current.map(doc => [String(doc._id), doc.order]));
    const updates = ids.map((id, order) => ({
        updateOne: {
            filter: { _id: new ObjectId(id), userId, deletedAt: null },
            update: { $set: { order, updatedAt: new Date() } },
        },
    })).filter((operation, order) => orders.get(ids[order]) !== order);
    if (updates.length) await collection.bulkWrite(updates);
    return true;
};

interface BookSettings { _id: string; showSignatures?: boolean; readingPlace?: ReadingPlace | null; commemorations?: Partial<CommemorationSettings> }
const bookSettings = async () => (await clientPromise).db("typikon-users").collection<BookSettings>("pomyannikSettings");

export const getBookSettings = async (userId: string) => {
    await ensureGroupMigration(userId);
    const doc = await (await bookSettings()).findOne({ _id: userId });
    return { showSignatures: doc?.showSignatures !== false, readingPlace: doc?.readingPlace ?? null, commemorations: readCommemorations(doc?.commemorations) };
};

export const setBookSettings = async (userId: string, showSignatures: boolean) => {
    await (await bookSettings()).updateOne({ _id: userId }, { $set: { showSignatures } }, { upsert: true });
};

export const setCommemorations = async (userId: string, raw: unknown) => {
    const patch = validateCommemorations(raw);
    for(const choice of Object.values(patch))if(choice.mode==="group"){try{await assertOwnGroups(userId,[choice.group]);}catch(e){throw new CommemorationError((e as Error).message);}}
    const fields = Object.fromEntries(Object.entries(patch).map(([place,value]) => [`commemorations.${place}`,value]));
    await (await bookSettings()).updateOne({ _id:userId }, { $set:fields }, { upsert:true });
    return (await getBookSettings(userId)).commemorations;
};

export const setReadingPlace = async (userId: string, readingPlace: ReadingPlace | null) => {
    if(readingPlace?.group){try{await assertOwnGroups(userId,[readingPlace.group]);}catch(e){if(e instanceof GroupError)return false;throw e;}}
    if (readingPlace && !await getPerson(userId, readingPlace.personId)) return false;
    await (await bookSettings()).updateOne({ _id: userId }, { $set: { readingPlace } }, { upsert: true });
    return true;
};

export const restorePersons = async (userId: string, raw: unknown) => {
    const backup = parseBackup(raw);
    const current = await listPersons(userId);
    const { additions, skipped } = planRestore(current.map(p=>({...p,groups:p.groupNames??[]})), backup.persons);
    if (current.length + additions.length > MAX_PERSONS) throw new BackupError(`После восстановления получится больше ${MAX_PERSONS} имён.`);
    const names=[...new Set([...(backup.groups??[]),...backup.persons.flatMap(p=>p.groups)])];
    const groupMap=new Map<string,string>();
    for(const name of names)groupMap.set(name,(await createGroup(userId,name)).id);
    if (!additions.length) return { added: 0, skipped };
    const now = new Date();
    let order = Math.max(0, ...current.map(person => person.order ?? 0)) + 1;
    // Не пересчитываем именины и не угадываем род: восстанавливаем сохранённые сведения.
    const docs = additions.map(person => ({ ...person, groups:[...new Set(person.groups.map(name=>groupMap.get(name)!))],groupsSchemaVersion:1, nameKey: nameKey(person.name), userId,
        order: order++, createdAt: now, updatedAt: now }));
    await (await persons()).insertMany(docs);
    return { added: docs.length, skipped };
};

// --- лента подписки --------------------------------------------------------

export interface PomyannikFeed {
    userId: string;
    /**
     * Адрес ленты. Хранится ОТКРЫТЫМ, а не хэшем, как ключи API: ссылку на ленту
     * надо уметь показать снова, а не один раз при выпуске. Расплата за это —
     * дамп базы открывает чужие ленты, и потому рядом со ссылкой стоят и смена
     * адреса, и запрет писать имена в календарь.
     */
    token: string;
    /** Писать ли в календарь сами имена или один их счёт. */
    withNames: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
}

const newToken = () => randomBytes(16).toString("hex");

export const getFeed = async (userId: string): Promise<PomyannikFeed | null> =>
    (await feeds()).findOne({ userId }) as Promise<PomyannikFeed | null>;

/** Завести ленту или сменить ей адрес. Прежний перестаёт работать сразу. */
export const setFeed = async (
    userId: string, options: { reset?: boolean; withNames?: boolean } = {},
): Promise<PomyannikFeed> => {
    const collection = await feeds();
    const current = await collection.findOne({ userId });

    const doc: PomyannikFeed = {
        userId,
        token: !current || options.reset ? newToken() : (current.token as string),
        withNames: options.withNames ?? (current?.withNames as boolean | undefined) ?? true,
        createdAt: (current?.createdAt as Date | undefined) ?? new Date(),
        lastUsedAt: (current?.lastUsedAt as Date | undefined) ?? null,
    };
    await collection.replaceOne({ userId }, doc, { upsert: true });
    return doc;
};

/** Чей это адрес. Отметка о последнем обращении — владельцу, чтобы видел живую ленту. */
export const feedByToken = async (token: string): Promise<PomyannikFeed | null> => {
    if (!/^[0-9a-f]{32}$/.test(String(token ?? ""))) return null;
    const collection = await feeds();
    const doc = await collection.findOne({ token });
    if (!doc) return null;
    await collection.updateOne({ token }, { $set: { lastUsedAt: new Date() } });
    return doc as unknown as PomyannikFeed;
};
