import clientPromise from "@/lib/mongodb";

export interface IDayMemory {
    id: string;
    name: string;
    sign: string;
    signConditional: boolean;
    order: number;
}

export interface IDayMemories {
    default: IDayMemory | null;
    secondary: IDayMemory[];
}

// Памяти дня из месяцеслова Типикона (коллекция "signs", см. /admin/signs) — по точной
// паре месяц+число (старый стиль, как churchDate в calcDay). Основная память (isDefault)
// отдаётся отдельно от второстепенных, отсортированных по order.
export const getDayMemories = async (month: number, date: number): Promise<IDayMemories> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const items = await db
            .collection("signs")
            .aggregate([
                {$match: {month, date}},
                {$sort: {order: 1}},
                {$addFields: {id: {$toString: "$_id"}}},
                {$project: {_id: 0, id: 1, name: 1, sign: 1, isDefault: 1, signConditional: 1, order: 1}},
            ])
            .toArray();

        const defaultMemory = items.find((item: any) => item.isDefault) || null;
        const secondary = items.filter((item: any) => item !== defaultMemory);

        return {
            default: defaultMemory as IDayMemory | null,
            secondary: secondary as IDayMemory[],
        };
    } catch (e) {
        console.error(e);
        return {default: null, secondary: []};
    }
};
