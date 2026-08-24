import clientPromise from "@/lib/mongodb";
import { LOGS, VISITORS, VISITS_DB } from "@/lib/meta/visits";

// Считается в базе, а не в приложении. Раньше сюда загружались ВСЕ документы журнала
// и складывались в JS — на 95 тысячах записей это дорогая операция на каждый показ
// страницы, и дорожала она линейно с ростом журнала.
//
// Просмотры складываются из подробных записей и из свёрнутых помесячных итогов
// (см. npm run db:optimize-logs). Посетители считаются по отдельной коллекции, поэтому
// чистка журнала на эту цифру не влияет.
export const getMeta = async (): Promise<[any, any]> => {
    try {
        const client = await clientPromise;
        const db = client.db(VISITS_DB);

        const [totals, totalUsers] = await Promise.all([
            db.collection(LOGS).aggregate([
                {
                    $group: {
                        _id: null,
                        details: { $sum: { $cond: [{ $eq: ["$kind", "summary"] }, 0, "$count"] } },
                        rolledUp: { $sum: { $cond: [{ $eq: ["$kind", "summary"] }, "$views", 0] } },
                    },
                },
            ]).toArray(),
            db.collection(VISITORS).estimatedDocumentCount(),
        ]);

        const totalCount = (totals[0]?.details ?? 0) + (totals[0]?.rolledUp ?? 0);

        return [{ totalCount, totalUsers }, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
