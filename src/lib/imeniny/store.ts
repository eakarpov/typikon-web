import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { nameKey } from "@/lib/imeniny/core";

// Указатель имён из базы. Строит его скрипт (npm run names:index), а не сайт:
// разбор заголовков святцев — наш вывод, и смотреть его надо отчётом прежде,
// чем показывать читателю.

export const NAME_INDEX = "name_index";

export interface IndexedSaint {
    slug: string;
    name: string;
    /** Дни памяти, как они записаны в святцах: «16.12» либо смещение от Пасхи. */
    dates: string[];
    /** «guess» — имя вынуто из соборной памяти, где их перечень вперемешку. */
    confidence: "sure" | "guess";
}

export interface NameEntry {
    key: string;
    name: string;
    saints: IndexedSaint[];
}

const collection = async () =>
    (await clientPromise).db("typikon").collection(NAME_INDEX);

const readEntry = async (key: string): Promise<NameEntry | null> => {
    const doc = await (await collection()).findOne({ key });
    if (!doc) return null;
    const { _id, ...rest } = doc as any;
    return rest as NameEntry;
};

const readNames = async (): Promise<Array<{ key: string; name: string; count: number }>> => {
    const docs = await (await collection())
        .find({}, { projection: { key: 1, name: 1, saints: 1 } })
        .toArray();
    return docs
        .map((doc: any) => ({ key: doc.key, name: doc.name, count: (doc.saints ?? []).length }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));
};

export const nameEntry = cached(readEntry, ["imeniny-name"], [CacheTag.SAINTS], 86400);
export const allNames = cached(readNames, ["imeniny-names"], [CacheTag.SAINTS], 86400);

/** Что набрал человек — к ключу указателя. */
export const keyOf = (raw: string | null | undefined): string | null => {
    const key = nameKey(String(raw ?? ""));
    return key.length >= 2 ? key : null;
};
