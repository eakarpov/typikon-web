import { cookies } from "next/headers";
import clientPromise from "@/lib/mongodb";
import { decrypt } from "@/lib/authorize/sessions";
import { getItem } from "@/app/profile/api";
import { userCan } from "@/lib/rights";

// КТО ВЕДЁТ РАСПИСАНИЕ ПРИХОДА.
//
// ОТВЕТСТВЕННЫЙ, А НЕ НАСТОЯТЕЛЬ. Настоятель за расписание отвечает, но сам
// его не верстает почти никогда: этим ведает тот, кому поручено, — регент,
// староста, помощник, свечница. Назвать эту роль настоятелем значило бы
// звать к экрану того, кто к нему не подойдёт, и не назвать того, кто
// подойдёт.
//
// Расписание висит на стенде, и править его вправе не всякий, кто открыл
// страницу. Но и общей админкой это не закроешь: ответственный — не
// администратор сайта, ему нечего делать в разборе книг, а сайту нечего
// решать за него, во сколько у них литургия.
//
// Оттого право здесь ИМЕННОЕ и на один храм: пользователь такой-то ведёт
// расписание такого-то храма. Зовёт тот, кто уже ведёт; первого заводит
// администратор сайта — иначе первым стал бы тот, кто раньше нажал.

export interface TempleAdmin {
    _id?: string;
    templeSlug: string;
    userId: string;
    /** Кто позвал. Пусто у первого — его завёл администратор сайта. */
    addedBy?: string | null;
    addedAt: Date;
    /**
     * КОГДА ЭТО ПРАВО В ПОСЛЕДНИЙ РАЗ ПОДТВЕРДИЛОСЬ ДЕЛОМ.
     *
     * Право не протухает само: человек ушёл из прихода, а связь осталась, и
     * расписание храма годами правит тот, кого там больше нет. Отбирать его
     * по часам мы не станем — приход не обязан отчитываться, — но знать, что
     * им давно не пользовались, надо: это первый признак, что храм осиротел.
     *
     * Отмечается делом, а не входом: правкой расписания и публикацией. Просто
     * зайти на страницу — не подтверждение.
     */
    confirmedAt?: Date | null;
}

const collection = async () =>
    (await clientPromise).db("typikon").collection<TempleAdmin>("templeAdmins");

const idOf = (templeSlug: string, userId: string) => `${templeSlug}:${userId}`;

/** Кто сейчас смотрит. null — не вошёл. */
export const currentUserId = async (): Promise<string | null> => {
    const cookie = (await cookies()).get("session")?.value;
    const session = await decrypt(cookie);
    return (session?.userId as string | undefined) ?? null;
};

// Право сайта вмешаться в приходское — ИМЕННО ЭТА возможность, а не
// «администратор вообще»: модератор приходов её имеет, а правящий книги — нет
const canGrantParish = async (userId: string): Promise<boolean> => {
    const [user] = await getItem(userId);
    return userCan(user, "parish.grant");
};

/** Найти пользователя по почте — для приглашения: userId наизусть никто не помнит. */
export const findUserByEmail = async (email: string) => {
    const users = (await clientPromise).db("typikon-users").collection("users");
    const u = await users.findOne({ email: email.trim() }, { projection: { email: 1, name: 1 } });
    return u ? { userId: String(u._id), email: u.email as string,
                 name: (u.name as string) ?? null } : null;
};

export interface ParishRights {
    userId: string | null;
    /** Может править расписание и публиковать его. */
    canEdit: boolean;
    /** Может звать других вести этот храм. */
    canInvite: boolean;
    /** Право пришло от админства сайта, а не от прихода. */
    asSiteAdmin: boolean;
}

/**
 * Права этого пользователя на этот храм.
 *
 * Администратор сайта может всё — но это ВИДНО (`asSiteAdmin`), и в подписи
 * правки он останется собой: приход должен понимать, кто менял его
 * расписание, а «правил администратор» и «правил наш ответственный» — разное.
 */
export const rightsOn = async (templeSlug: string): Promise<ParishRights> => {
    const userId = await currentUserId();
    if (!userId) {
        return { userId: null, canEdit: false, canInvite: false, asSiteAdmin: false };
    }
    const mine = await (await collection()).findOne({ templeSlug, userId });
    if (mine) {
        return { userId, canEdit: true, canInvite: true, asSiteAdmin: false };
    }
    const site = await canGrantParish(userId);
    return { userId, canEdit: site, canInvite: site, asSiteAdmin: site };
};

/** Кто ведёт этот храм — для страницы прихода. */
export const adminsOf = async (templeSlug: string) =>
    (await collection()).find({ templeSlug }).sort({ addedAt: 1 }).toArray();

/** Храмы, которые ведёт этот пользователь, — для его профиля. */
export const templesOf = async (userId: string) =>
    (await collection()).find({ userId }).sort({ addedAt: 1 }).toArray();

export const addAdmin = async (templeSlug: string, userId: string, addedBy?: string) => {
    const col = await collection();
    await col.replaceOne(
        { _id: idOf(templeSlug, userId) } as never,
        { _id: idOf(templeSlug, userId), templeSlug, userId,
          addedBy: addedBy ?? null, addedAt: new Date(), confirmedAt: new Date() } as never,
        { upsert: true },
    );
};

/** Право подтвердилось делом — правкой или публикацией. */
export const touchAdmin = async (templeSlug: string, userId: string) => {
    await (await collection()).updateOne(
        { _id: idOf(templeSlug, userId) } as never,
        { $set: { confirmedAt: new Date() } },
    );
};

/** Сколько дней назад правом пользовались. null — ни разу с тех пор, как дано. */
export const staleDays = (a: TempleAdmin): number | null => {
    const at = a.confirmedAt ?? a.addedAt;
    if (!at) return null;
    return Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
};

/**
 * Снять право. ПОСЛЕДНЕГО НЕ СНИМАЕМ: храм без ведущего никто уже не поправит,
 * и вернуть право сможет только администратор сайта — а он про этот храм
 * ничего не знает. Уходящий обязан сперва позвать преемника.
 */
export const removeAdmin = async (templeSlug: string, userId: string): Promise<boolean> => {
    const col = await collection();
    if (await col.countDocuments({ templeSlug }) <= 1) return false;
    await col.deleteOne({ _id: idOf(templeSlug, userId) } as never);
    return true;
};
