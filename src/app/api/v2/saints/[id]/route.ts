import clientPromise from "@/lib/mongodb";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { textSummary } from "@/lib/api/v2/serialize";
import { cached, CacheTag } from "@/lib/cache";

// Тексты, связанные со святым. Идентификатор — из святцев dneslov.org: своей
// идентичности святых в проекте нет, она целиком живёт там.
//
// Сведения о самом святом (имя, икона, память) здесь не отдаются: это чужие данные,
// их следует брать у dneslov.org напрямую.
export const revalidate = 3600;

const PROJECTION = {
    alias: 1, name: 1, description: 1, author: 1, translator: 1, type: 1,
    contentType: 1, readiness: 1, bookId: 1, bookIndex: 1, dneslovId: 1, updatedAt: 1,
};

const loadSaint = cached(async (dneslovId: string) => {
    const client = await clientPromise;
    const texts = client.db("typikon").collection("texts");

    const [about, mentions] = await Promise.all([
        texts.find({ dneslovId }, { projection: PROJECTION }).toArray(),
        texts.find({ mentionIds: dneslovId }, { projection: PROJECTION }).toArray(),
    ]);

    return { about, mentions };
}, ["api-v2-saint"], [CacheTag.TEXTS]);

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    if (!/^\d+$/.test(params.id)) {
        return fail("bad_request", "Идентификатор святого — число из святцев dneslov.org");
    }

    try {
        const { about, mentions } = await loadSaint(params.id);

        if (!about.length && !mentions.length) {
            return fail("not_found", `Для святого ${params.id} текстов не найдено`);
        }

        return respond({
            dneslovId: params.id,
            dneslovUrl: `https://dneslov.org/api/v0/memories/${params.id}.json`,
            texts: about.map(textSummary),
            mentions: mentions.map(textSummary),
        }, { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить тексты святого");
    }
}
