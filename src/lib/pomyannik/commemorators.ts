import clientPromise from "@/lib/mongodb";
import { NOTE_KIND_BY_KEY, type NoteKind } from "@/lib/pomyannik/types";
import { newInviteCode, newToken, slugOf } from "@/lib/pomyannik/claim";

// Чистые правила заявки живут в claim.ts; здесь только база. Наружу они
// выставлены отсюда же, чтобы вызывающему не приходилось знать про этот раздел.
export { checkDomain, newInviteCode, newToken, slugOf } from "@/lib/pomyannik/claim";
export type { DomainCheck, DomainMatch } from "@/lib/pomyannik/claim";

// КТО ПРИНИМАЕТ ЗАПИСКИ.
//
// ПРАВО ЛИЧНОЕ, А НЕ ПРИХОДСКОЕ, и это решение, а не упущение. Записка у ящика
// — дело денежное: храм на ней зарабатывает, и всякая привязка приёма к приходу
// потянула бы за собою счёт, отчисления и спор о том, чья это была треба. Оплат
// у нас нет, а потому и приход тут ни при чём: записку принимает СВЯЩЕННИК, и
// отвечает за неё он сам.
//
// Оттого прихожанин приходит по коду-приглашению, какой священник раздаёт сам
// (ссылка, объявление на стенде), а не ищет храм в справочнике. Кто готов
// принимать от всех — открывает страницу, и она попадает в общий список.
//
// ПОДТВЕРЖДЕНИЕ ДВУХЧАСТНОЕ, И ЧАСТИ ЕГО ВРОЗЬ НЕ РАБОТАЮТ.
//
//   СТРАНИЦА ЕПАРХИИ, где этот священник назван. Клир епархия выкладывает сама,
//   и это единственный открытый список, которому есть чем верить.
//
//   ОТВЕТНОЕ ПИСЬМО на адрес в домене той же епархии. Мы шлём письмо с кодом
//   подтверждения, человек отвечает, модератор сверяет код глазами.
//
// Ссылка без письма доказывает, что священник с таким именем есть, — но не что
// заявитель это он. Письмо без ссылки доказывает владение ящиком, а не сан.
// Вместе они доказывают.
//
// ЭТО РАСХОДИТСЯ С РЕШЕНИЕМ В lib/parish/claims, и расхождение намеренное. Там
// подтверждение по домену почты отвергнуто прямо: у приходов почта на общих
// службах, и домен не значит ничего. Здесь домен ЕПАРХИАЛЬНЫЙ, а не приходской,
// и значит он ровно то, что нужно. Прочесть это как забывчивость нельзя.

const db = async () => (await clientPromise).db("typikon-users");

export type ClaimStatus =
    /** подана, письмо ещё не ушло */
    | "pending"
    /** письмо с кодом отправлено, ждём ответа */
    | "letter-sent"
    /** ответ пришёл и код сошёлся — осталось решить */
    | "verified"
    | "approved"
    | "rejected";

export interface CommemoratorClaim {
    _id?: string;
    userId: string;
    /** Как представился: «иерей Николай Петров». */
    title: string;
    /** Страница епархии, где он назван. */
    dioceseUrl: string;
    /** Адрес, на который уйдёт письмо с кодом подтверждения. */
    email: string;
    /**
     * Что священник счёл нужным добавить от себя.
     *
     * ТЕЛЕФОНА ЗДЕСЬ НЕТ НАРОЧНО. Он тут был — «если удобнее разговором», — но
     * разговор не путь подтверждения: священник может служить за рубежом, в
     * ином часовом поясе, в приходе, куда не дозвонишься. Почта доходит всюду и
     * одинаково, а ответное письмо с епархиального адреса подтверждает не хуже
     * звонка — и в отличие от звонка остаётся записанным.
     */
    evidence?: string | null;
    status: ClaimStatus;
    /** Знак в письме. Не ключ: им ничего не открыть, он только сличается. */
    token: string;
    letterSentAt?: Date | null;
    repliedAt?: Date | null;
    checkNote?: string | null;
    decidedBy?: string | null;
    decidedAt?: Date | null;
    decisionNote?: string | null;
    again?: boolean;
    priorDecision?: { at: Date | null; by: string | null; note: string | null } | null;
    createdAt: Date;
}

export interface Commemorator {
    _id?: string;
    userId: string;
    title: string;
    /** Где служит — свободной строкой. Подпись, а не право на храм. */
    place: string | null;
    dioceseUrl: string | null;
    /** Открыт ли приём для всех: тогда он в общем списке. */
    public: boolean;
    /** Адрес открытой страницы. */
    slug: string;
    /** Код-приглашение: по нему приходят те, кому он его дал. */
    inviteCode: string;
    accepts: NoteKind[];
    about: string | null;
    confirmedBy: string | null;
    confirmedAt: Date | null;
    createdAt: Date;
}

const claims = async () => (await db()).collection<CommemoratorClaim>("commemoratorClaims");
const people = async () => (await db()).collection<Commemorator>("commemorators");

// --- заявки ----------------------------------------------------------------

export const claimOf = async (userId: string) =>
    (await claims()).findOne({ userId });

export const claimsByStatus = async (status: ClaimStatus[]) =>
    (await claims()).find({ status: { $in: status } }).sort({ createdAt: 1 }).toArray();

/**
 * Подать заявку — или подать её снова.
 *
 * Отказ держится: повторная приходит помеченной, и прежнее решение с причиной
 * никуда не девается. Приём взят у приходских заявок и нужен здесь по той же
 * причине: иначе решение обходится нажатием кнопки.
 *
 * Знак при повторной подаче НЕ МЕНЯЕТСЯ: человек мог уже ответить на письмо.
 */
export const saveClaim = async (
    claim: Omit<CommemoratorClaim, "_id" | "createdAt" | "token" | "status">,
): Promise<CommemoratorClaim> => {
    const col = await claims();
    const _id = claim.userId;
    const existing = await col.findOne({ _id } as never);
    const again = existing?.status === "rejected";

    const doc: CommemoratorClaim = {
        ...claim,
        token: existing?.token ?? newToken(),
        status: "pending",
        letterSentAt: existing?.letterSentAt ?? null,
        repliedAt: null,
        checkNote: null,
        again,
        priorDecision: again
            ? { at: existing!.decidedAt ?? null, by: existing!.decidedBy ?? null,
                note: existing!.decisionNote ?? null }
            : existing?.priorDecision ?? null,
        createdAt: existing?.createdAt ?? new Date(),
    };
    await col.replaceOne({ _id } as never, { ...doc, _id } as never, { upsert: true });
    return { ...doc, _id };
};

export const markLetterSent = async (userId: string) => {
    await (await claims()).updateOne({ _id: userId } as never,
        { $set: { status: "letter-sent", letterSentAt: new Date() } });
};

/** Ответ пришёл и код сошёлся — сверял человек, не машина. */
export const markReplied = async (userId: string, note: string) => {
    await (await claims()).updateOne({ _id: userId } as never,
        { $set: { status: "verified", repliedAt: new Date(), checkNote: note } });
};

export const decideClaim = async (
    userId: string, status: "approved" | "rejected", decidedBy: string, note?: string,
) => {
    await (await claims()).updateOne({ _id: userId } as never,
        { $set: { status, decidedBy, decidedAt: new Date(), decisionNote: note ?? null } });
};

// --- принимающие -----------------------------------------------------------

const freeSlug = async (title: string, userId: string): Promise<string> => {
    const base = slugOf(title);
    const col = await people();
    for (let i = 0; i < 50; i++) {
        const slug = i ? `${base}-${i + 1}` : base;
        const taken = await col.findOne({ slug });
        if (!taken || taken.userId === userId) return slug;
    }
    // Полсотни тёзок подряд — уже не совпадение; уводим адрес в случайный.
    return `${base}-${newInviteCode().slice(0, 6).toLowerCase()}`;
};

/** Завести принимающего — только по принятой заявке. */
export const createCommemorator = async (
    claim: CommemoratorClaim, confirmedBy: string,
): Promise<Commemorator> => {
    const col = await people();
    const existing = await col.findOne({ userId: claim.userId });

    const doc: Commemorator = {
        userId: claim.userId,
        title: claim.title,
        place: existing?.place ?? null,
        dioceseUrl: claim.dioceseUrl,
        // Открывать приём для всех — его решение, а не наше: принятая заявка
        // даёт право принимать, а не обязанность стоять в общем списке.
        public: existing?.public ?? false,
        slug: existing?.slug ?? await freeSlug(claim.title, claim.userId),
        inviteCode: existing?.inviteCode ?? newInviteCode(),
        accepts: existing?.accepts ?? [],
        about: existing?.about ?? null,
        confirmedBy,
        confirmedAt: new Date(),
        createdAt: existing?.createdAt ?? new Date(),
    };
    await col.replaceOne({ userId: claim.userId }, doc, { upsert: true });
    return doc;
};

export const commemoratorOf = async (userId: string) =>
    (await people()).findOne({ userId });

export const commemoratorBySlug = async (slug: string) =>
    (await people()).findOne({ slug, public: true });

export const commemoratorByCode = async (code: string) => {
    if (!/^[A-Za-z0-9_-]{8,24}$/.test(String(code ?? ""))) return null;
    return (await people()).findOne({ inviteCode: code });
};

/** Кто принимает от всех — для открытого списка. */
export const publicCommemorators = async () =>
    (await people()).find({ public: true }).sort({ title: 1 }).toArray();

/** Что священник о себе правит сам. Сан и епархия отсюда не меняются. */
export const updateCommemorator = async (
    userId: string,
    patch: { place?: string | null; about?: string | null;
             accepts?: string[]; public?: boolean; resetCode?: boolean },
): Promise<Commemorator | null> => {
    const col = await people();
    const current = await col.findOne({ userId });
    if (!current) return null;

    const accepts = Array.isArray(patch.accepts)
        ? [...new Set(patch.accepts.filter(k => NOTE_KIND_BY_KEY[k]))] as NoteKind[]
        : current.accepts;

    const next: Partial<Commemorator> = {
        place: patch.place !== undefined
            ? (String(patch.place ?? "").trim().slice(0, 200) || null) : current.place,
        about: patch.about !== undefined
            ? (String(patch.about ?? "").trim().slice(0, 1000) || null) : current.about,
        accepts,
        public: typeof patch.public === "boolean" ? patch.public : current.public,
        ...(patch.resetCode ? { inviteCode: newInviteCode() } : {}),
    };
    await col.updateOne({ userId }, { $set: next });
    return { ...current, ...next } as Commemorator;
};
