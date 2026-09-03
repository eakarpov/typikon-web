import { randomBytes } from "node:crypto";
import { parishDb } from "./db";
import type { Temple } from "@/lib/temples";

// ЗАЯВКА НА ВЕДЕНИЕ РАСПИСАНИЯ.
//
// Храмов в справочнике шестьдесят пять тысяч, все из открытых данных, и своим
// может назвать любой кто угодно. Ошибка тут не испорченная запись, а ЧУЖОЕ
// РАСПИСАНИЕ ПОД ИМЕНЕМ НАСТОЯЩЕГО ПРИХОДА: люди придут к запертому храму.
// Оттого «никто не возразил» согласием здесь не считается.
//
// ГЛАВНОЕ ПРАВИЛО — КУДА ЗАЯВКА ИДЁТ. Если у храма ответственный уже есть,
// она идёт К НЕМУ, а не к нам: решать, кто ведёт чужой приход, мы не вправе.
// До нашей очереди доходит только заявка на храм, у которого ведущего нет.
//
// ДВА ПУТИ ПОДТВЕРЖДЕНИЯ, и оба честные.
//
//   САЙТОМ ПРИХОДА. Машинная проверка: заявитель кладёт наш знак на сайт
//   храма, мы читаем и сверяем. Кто может править сайт прихода — тот и
//   приход. Работает там, где сайт известен: по данным OSM это примерно
//   каждый двадцатый православный храм.
//
//   РАЗГОВОРОМ. Всё остальное. Заявитель говорит, кто он и чем подтвердит;
//   модератор звонит, смотрит и решает сам. Для продукта, где заявок единицы
//   в неделю, это не затычка, а основной путь.
//
// Чего здесь нет нарочно: подтверждения по домену почты. У наших приходов
// почта на общих службах, и домен не значит ничего.

export type ClaimStatus =
    /** ждёт: либо знака на сайте, либо человека */
    | "pending"
    /** знак на сайте сошёлся — machine сказала «да», осталось записать */
    | "verified"
    | "approved"
    | "rejected";

export type ClaimMethod = "site-token" | "manual";

export interface TempleClaim {
    _id?: string;
    templeSlug: string;
    userId: string;
    /** Регент, староста, помощник, свечница — как сам себя назовёт. */
    role: string;
    /** Телефон или почта, по которым с ним свяжутся. */
    contact: string;
    /** Чем подтверждает: ссылка, слова, «звоните настоятелю». */
    evidence?: string;
    status: ClaimStatus;
    method: ClaimMethod;
    /** Знак для сайта прихода. Заводится всегда: сайт может появиться после. */
    token: string;
    /** Что вышло при последней проверке сайта — словами, для человека. */
    checkNote?: string | null;
    checkedAt?: Date | null;
    /** Кто решил и почему. */
    decidedBy?: string | null;
    decidedAt?: Date | null;
    decisionNote?: string | null;
    /** Подана снова после отказа — разбирающий должен это видеть. */
    again?: boolean;
    /** Чем кончилось в прошлый раз. Отказ не стирается повторной заявкой. */
    priorDecision?: { at: Date | null; by: string | null; note: string | null } | null;
    createdAt: Date;
}

const collection = async () =>
    (await parishDb()).collection<TempleClaim>("templeClaims");

/**
 * Знак для сайта. Не тайна и не ключ: им ничего не открыть, он только
 * связывает заявку с сайтом. Оттого и короткий — его переписывают руками.
 */
export const newToken = () => `typikon-${randomBytes(6).toString("hex")}`;

/** Где мы его ищем. Первый — по правилам, остальные — как кладут на деле. */
export const tokenPaths = (site: string): string[] => {
    const base = site.replace(/\/+$/, "");
    return [`${base}/.well-known/typikon.txt`, `${base}/typikon.txt`, base];
};

export const claimsOf = async (templeSlug: string) =>
    (await collection()).find({ templeSlug }).sort({ createdAt: -1 }).toArray();

export const myClaim = async (templeSlug: string, userId: string) =>
    (await collection()).findOne({ templeSlug, userId });

export const claimsByStatus = async (status: ClaimStatus[]) =>
    (await collection()).find({ status: { $in: status } })
        .sort({ createdAt: 1 }).toArray();

export const saveClaim = async (
    claim: Omit<TempleClaim, "_id" | "createdAt" | "token" | "status"> &
          Partial<Pick<TempleClaim, "token" | "status">>,
) => {
    const col = await collection();
    const _id = `${claim.templeSlug}:${claim.userId}`;
    const existing = await col.findOne({ _id } as never);

    // ОТКАЗ ДЕРЖИТСЯ. Прежде повторная заявка молча возвращала запись в
    // очередь: отказали — отправил снова, и она пришла как новая, без следа
    // прежнего решения. Так решение модератора обходилось нажатием кнопки.
    //
    // Отправить снова МОЖНО — человек мог собрать доводы, — но приходит она
    // помеченной, и прежний отказ с его причиной никуда не девается: пусть
    // разбирающий видит, что уже отказывал и почему.
    const again = existing?.status === "rejected";

    const doc: TempleClaim = {
        ...claim,
        // ЗНАК НЕ МЕНЯЕТСЯ ПРИ ПОВТОРНОЙ ЗАЯВКЕ: человек мог уже положить его
        // на сайт, и подменить знак значило бы обесценить сделанное
        token: existing?.token ?? claim.token ?? newToken(),
        status: claim.status ?? "pending",
        again,
        priorDecision: again
            ? { at: existing!.decidedAt ?? null, by: existing!.decidedBy ?? null,
                note: existing!.decisionNote ?? null }
            : existing?.priorDecision ?? null,
        createdAt: existing?.createdAt ?? new Date(),
    } as TempleClaim;
    await col.replaceOne({ _id } as never, { ...doc, _id } as never, { upsert: true });
    return { ...doc, _id };
};

export const decideClaim = async (
    _id: string, status: ClaimStatus, decidedBy: string, note?: string,
) => {
    await (await collection()).updateOne({ _id } as never, {
        $set: { status, decidedBy, decidedAt: new Date(), decisionNote: note ?? null },
    });
};

export const markChecked = async (_id: string, ok: boolean, note: string) => {
    await (await collection()).updateOne({ _id } as never, {
        $set: { status: ok ? "verified" : "pending", checkNote: note, checkedAt: new Date() },
    });
};

/**
 * Ищет знак на сайте прихода.
 *
 * Читается САЙТ ХРАМА, взятый из справочника, а не тот, что назвал заявитель:
 * иначе проверка ничего не проверяет — всякий положил бы знак на свою
 * страницу. Сайта нет — и путь этот закрыт, остаётся разговор.
 */
export const checkSite = async (
    temple: Temple, token: string,
): Promise<{ ok: boolean; note: string }> => {
    const site = temple.website;
    if (!site) {
        return { ok: false, note: "у храма в справочнике не записан сайт — проверять негде" };
    }
    // ЗАГОЛОВОК ТОЛЬКО ЛАТИНИЦЕЙ. HTTP-заголовок — байтовая строка, и
    // кириллица в нём роняет сам запрос, не дойдя до сети. Стояла здесь
    // русская подпись, и падали ВСЕ три попытки разом — а наружу это
    // выглядело как «знака на сайте нет». Молчаливый сбой и отрицательный
    // ответ здесь неразличимы, и потому ниже причина запоминается.
    const headers = { "User-Agent": "typikon.su/1.0 (+https://www.typikon.su)" };
    let lastError: string | null = null;

    for (const url of tokenPaths(site)) {
        try {
            const r = await fetch(url, {
                signal: AbortSignal.timeout(8000), headers, redirect: "follow",
            });
            if (!r.ok) { lastError = `${url}: ответ ${r.status}`; continue; }
            // Читаем НАЧАЛО страницы: знак кладут на видное место, а тянуть
            // целиком чужой сайт незачем
            const text = (await r.text()).slice(0, 200_000);
            if (text.includes(token)) return { ok: true, note: `знак найден: ${url}` };
        } catch (e) {
            lastError = `${url}: ${(e as Error).message}`;
        }
    }
    // СБОЙ НАЗЫВАЕТСЯ, А НЕ ВЫДАЁТСЯ ЗА ОТВЕТ: «сайт не отвечает» и «знака там
    // нет» — разные беды, и человеку, который знак только что положил, надо
    // знать, какая из них
    return {
        ok: false,
        note: lastError
            ? `знака не нашлось на ${site}; последняя попытка — ${lastError}`
            : `знака нет ни по одному адресу на ${site}`,
    };
};
