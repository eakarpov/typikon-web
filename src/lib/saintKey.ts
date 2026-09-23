// Ключ святого в каталоге (`saints._id`) по тому, что вставил человек или
// лежит в старых данных: ссылка на страницу, адрес, ключ записи, номер святцев.
// Нужен всем, кто теперь ссылается на святого ключом: реестру святынь, текстам.

import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { byExternal, SAINT_SOURCES } from "@/lib/saintSources";

/**
 * Адреса, как их вставляет человек: ссылка на страницу сайта или сам адрес.
 * «https://www.typikon.info/saints/sergii-radonezhskii» и «sergii-radonezhskii»
 * значат одно; номер святцев принимается как есть.
 */
export const lastSegment = (raw: unknown): string => {
    const s = String(raw ?? "").trim();
    try {
        const u = new URL(s);
        return decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "");
    } catch {
        return s.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
    }
};

/**
 * Ключ святого в каталоге по тому, что вставил человек: ссылка на страницу,
 * адрес, ключ записи или, для старых привычек, номер святцев.
 */
export const saintIdOf = async (raw: unknown): Promise<string | null> => {
    const address = lastSegment(raw);
    if (!address) return null;
    const saints = (await clientPromise).db("typikon").collection("saints");
    if (/^[a-f0-9]{24}$/.test(address)) {
        return (await saints.findOne({ _id: new ObjectId(address) }, { projection: { _id: 1 } })) ? address : null;
    }
    if (/^\d+$/.test(address)) {
        const byNumber = await saints.findOne(byExternal(SAINT_SOURCES.dneslov.code, address), { projection: { _id: 1 } });
        return byNumber ? String(byNumber._id) : null;
    }
    // Прямым запросом, а не кэшированной выборкой страниц: функцию зовут и
    // скрипты, а у них кэша Next нет.
    const saint = await saints.findOne({ $or: [{ slug: address }, { previousSlugs: address }] }, { projection: { _id: 1 } });
    return saint?._id ? String(saint._id) : null;
};
