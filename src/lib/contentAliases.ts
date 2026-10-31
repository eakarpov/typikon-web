import { ObjectId, type Db, type Document } from "mongodb";

export type AliasCollection = "books" | "texts";
export class AliasError extends Error {
    constructor(message: string, public status: number = 400) { super(message); }
}

export const aliasMatcher = (address: string) => ObjectId.isValid(address)
    ? { _id: new ObjectId(address) }
    : { $or: [{ alias: address }, { aliases: address }] };

// aliases включает нынешний адрес и все прежние. Один уникальный multikey-индекс
// защищает их ОБЩЕЕ пространство; два отдельных индекса alias/history этого не умеют.
export function aliasKeys(doc: Document): string[] {
    return [...new Set([
        ...(Array.isArray(doc.aliases) ? doc.aliases : []), doc.alias,
    ].filter((v): v is string => typeof v === "string" && v.length > 0))];
}

export function aliasPatch(current: Document, input: unknown) {
    if (input !== undefined && typeof input !== "string") throw new AliasError("Алиас должен быть строкой");
    const alias = input === undefined ? String(current.alias ?? "") : (input as string).trim();
    // Старые адреса не нормализуем и не переименовываем при сохранении содержимого.
    if (alias && alias !== current.alias && (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(alias)
        || alias.length > 120 || ObjectId.isValid(alias))) {
        throw new AliasError("Алиас: латинские буквы, цифры, дефисы или подчёркивания; до 120 знаков, не ObjectId");
    }
    return { alias, aliases: aliasKeys({ aliases: aliasKeys(current), alias }) };
}

export const canonicalPath = (section: "library" | "reading", doc: { alias?: string; id?: string; _id?: unknown }) =>
    `/${section}/${doc.alias || doc.id || String(doc._id)}`;

export function withSearch(path: string, search: Record<string, string | string[] | undefined>) {
    const url = new URL(path, "https://typikon.invalid");
    for (const [name, value] of Object.entries(search)) {
        if (value === undefined) continue;
        // Параметры цели (например, издание Библии) имеют приоритет над прежними.
        if (url.searchParams.has(name)) continue;
        for (const part of Array.isArray(value) ? value : [value]) url.searchParams.append(name, part);
    }
    return url.pathname + url.search;
}

export const ALIAS_KEYS_INDEX = {
    unique: true, partialFilterExpression: { aliases: { $exists: true } },
};

/** Содержимое и история адресов пишутся одним атомарным обновлением документа. */
export async function saveWithAlias(db: Db, name: AliasCollection, id: string, input: unknown, fields: Document) {
    if (!ObjectId.isValid(id)) throw new AliasError("Неверный идентификатор");
    const collection = db.collection(name);
    const current = await collection.findOne({ _id: new ObjectId(id) }, { projection: { alias: 1, aliases: 1 } });
    if (!current) throw new AliasError("Запись не найдена", 404);
    const patch = aliasPatch(current, input);
    if (name === "texts" && patch.alias === "random") throw new AliasError("Адрес random занят служебной ручкой", 409);
    const wanted = patch.aliases;
    if (wanted.length && await collection.findOne({
        _id: { $ne: current._id }, $or: [{ alias: { $in: wanted } }, { aliases: { $in: wanted } }],
    }, { projection: { _id: 1 } })) throw new AliasError("Адрес уже занят или сохранён за другой записью", 409);
    if (name === "texts" && wanted.length && await db.collection("bible_books")
        .findOne({ alias: { $in: wanted } }, { projection: { _id: 1 } })) {
        throw new AliasError("Этот адрес сохранён за библейским текстом", 409);
    }
    try {
        const result = await collection.updateOne({
            _id: current._id,
            // Не теряем историю при одновременном переименовании двумя редакторами.
            alias: current.alias === undefined ? { $exists: false } : current.alias,
            aliases: current.aliases === undefined ? { $exists: false } : current.aliases,
        }, { $set: { ...fields, alias: patch.alias, ...(wanted.length ? { aliases: wanted } : {}) } });
        if (!result.matchedCount) throw new AliasError("Адрес изменился другим редактором; обновите страницу", 409);
    } catch (error) {
        if ((error as { code?: number }).code === 11000) throw new AliasError("Адрес уже занят другой записью", 409);
        throw error;
    }
}
