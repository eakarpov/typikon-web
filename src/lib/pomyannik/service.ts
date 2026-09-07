import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { nameKey, normalizeName } from "@/lib/imeniny/core";
import { autoNameDay } from "@/lib/pomyannik/nameday";
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
    const name = normalizeName(String(input.name ?? "")).slice(0, 60);
    const key = nameKey(name);
    if (!key) return null;

    const rank = typeof input.rank === "string" && RANK_BY_KEY[input.rank]
        ? input.rank : null;
    const kind = input.kind === "departed" ? "departed" : "living";
    const died = isoDate(input.died);

    const groups = Array.isArray(input.groups)
        ? [...new Set(input.groups.map(g => String(g ?? "").trim().slice(0, 40)).filter(Boolean))]
              .slice(0, 10)
        : [];

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
        relation: input.relation ? String(input.relation).trim().slice(0, 60) || null : null,
        born: isoDate(input.born),
        baptized: isoDate(input.baptized),
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
    return { ...rest, id: String(_id) } as PomyannikPerson;
};

/**
 * Именины досчитываются сами, но НЕ ПЕРЕБИВАЮТ названных человеком: посчитанное
 * несёт помету `auto`, и стоит человеку назвать свои именины, как расчёт
 * умолкает. Он же и не считает ничего без дня рождения — гадать не из чего.
 */
const withNameDay = async (doc: ReturnType<typeof clean>) => {
    if (!doc) return doc;
    if (doc.nameDay && doc.nameDay.source === "manual") return doc;
    if (!doc.born) return { ...doc, nameDay: doc.nameDay?.source === "auto" ? null : doc.nameDay };
    const auto = await autoNameDay(doc.churchName || doc.name, doc.born);
    return { ...doc, nameDay: auto ?? doc.nameDay ?? null };
};

export const listPersons = async (userId: string): Promise<PomyannikPerson[]> => {
    const docs = await (await persons())
        .find({ userId })
        .sort({ kind: 1, order: 1, name: 1 })
        .toArray();
    return docs.map(out);
};

export const countPersons = async (userId: string): Promise<number> =>
    (await persons()).countDocuments({ userId });

export const getPerson = async (userId: string, id: string): Promise<PomyannikPerson | null> => {
    if (!ObjectId.isValid(id)) return null;
    const doc = await (await persons()).findOne({ _id: new ObjectId(id), userId });
    return doc ? out(doc) : null;
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
    const batch = inputs.slice(0, MAX_BATCH);
    const cleaned = (await Promise.all(batch.map(i => withNameDay(clean(i)))))
        .filter(Boolean) as Array<NonNullable<ReturnType<typeof clean>>>;
    if (!cleaned.length) return [];

    const collection = await persons();
    const already = await collection.countDocuments({ userId });
    if (already + cleaned.length > MAX_PERSONS) throw new TooManyPersonsError(MAX_PERSONS);

    const last = await collection.find({ userId }).sort({ order: -1 }).limit(1).toArray();
    let order = (last[0]?.order ?? 0) + 1;

    const now = new Date();
    const docs = cleaned.map(doc => ({ ...doc, userId, order: order++, createdAt: now, updatedAt: now }));
    const result = await collection.insertMany(docs as any[]);

    return docs.map((doc, i) => out({ ...doc, _id: result.insertedIds[i] }));
};

export const updatePerson = async (
    userId: string, id: string, patch: PersonInput,
): Promise<PomyannikPerson | null> => {
    if (!ObjectId.isValid(id)) return null;
    const collection = await persons();
    const current = await collection.findOne({ _id: new ObjectId(id), userId });
    if (!current) return null;

    // Правка приходит целым лицом, а не по полю: иначе пришлось бы решать, что
    // значит отсутствующее поле — «не трогай» или «сотри», — и на этом вопросе
    // рано или поздно кто-нибудь потеряет дату преставления.
    const doc = await withNameDay(clean({ ...(current as any), ...patch, name: patch.name ?? current.name }));
    if (!doc) return null;

    await collection.updateOne(
        { _id: new ObjectId(id), userId },
        { $set: { ...doc, updatedAt: new Date() } },
    );
    return out({ ...current, ...doc, _id: current._id });
};

export const deletePerson = async (userId: string, id: string): Promise<boolean> => {
    if (!ObjectId.isValid(id)) return false;
    const result = await (await persons()).deleteOne({ _id: new ObjectId(id), userId });
    return result.deletedCount > 0;
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
