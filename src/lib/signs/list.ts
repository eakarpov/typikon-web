import clientPromise from "@/lib/mongodb";

export interface SignsListParams {
    page?: number;
    pageSize?: number;
    q?: string;
    month?: number;
    sign?: string;
    source?: string;
    needsReview?: boolean;
}

export interface SignsListResult {
    items: any[];
    total: number;
    page: number;
    pageSize: number;
    error: string | null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getSignsList = async (params: SignsListParams): Promise<SignsListResult> => {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));

    const match: Record<string, any> = {};
    if (params.month) match.month = params.month;
    if (params.sign) match.sign = params.sign;
    if (params.source) match.source = params.source;
    if (params.needsReview !== undefined) match.needsReview = params.needsReview;
    if (params.q) match.name = { $regex: escapeRegex(params.q), $options: "i" };

    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const collection = db.collection("signs");

        const [items, total] = await Promise.all([
            collection.aggregate([
                { $match: match },
                { $sort: { month: 1, date: 1, order: 1 } },
                { $skip: (page - 1) * pageSize },
                { $limit: pageSize },
                { $addFields: { id: { $toString: "$_id" } } },
                { $project: { _id: 0 } },
            ]).toArray(),
            collection.countDocuments(match),
        ]);

        return { items, total, page, pageSize, error: null };
    } catch (e) {
        console.error(e);
        return { items: [], total: 0, page, pageSize, error: "Ошибка при загрузке данных" };
    }
};
