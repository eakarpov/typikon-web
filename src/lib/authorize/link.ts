import "server-only";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {reportError} from "@/lib/reportError";
import {AUTH_KEY, type Provider} from "@/lib/authorize/providers";

/**
 * Привязка второго входа к уже открытой учётной записи.
 *
 * Понадобилась с закрытием ВК: у части читателей он был единственным входом, и
 * без привязки их помянник и заметки оставались бы на записи, в которую нельзя
 * попасть. Отсюда правило, которое здесь главное: **привязка делается из-под уже
 * открытой сессии**, то есть человек сначала доказывает, что запись его, и лишь
 * потом присоединяет к ней новый вход. Обратный порядок — «войди новым способом
 * и укажи, к чему присоединить» — отдавал бы чужую запись всякому, кто знает
 * чужой идентификатор.
 *
 * Сам идентификатор у провайдера проверяется до вызова, теми же средствами, что
 * и при входе (подпись Telegram, id_token Google, обмен кода у Яндекса): ручка
 * привязки не должна уметь того, чего не умеет вход.
 */

export type LinkOutcome =
    /** Привязано. */
    | "ok"
    /** Этот же вход у вас уже привязан — повтор ничего не меняет. */
    | "already-yours"
    /** Этот вход принадлежит ДРУГОЙ записи на сайте. */
    | "taken"
    /** У вас уже привязан другой аккаунт того же провайдера. */
    | "occupied"
    | "no-user"
    | "error";

export type UnlinkOutcome =
    | "ok"
    /** Снять нечего: такой привязки нет. */
    | "absent"
    /** Это последний рабочий вход — сняв его, вы потеряете запись. */
    | "last"
    | "no-user"
    | "error";

/** Какие привязки есть у записи сейчас — чтобы страница обновилась без перезагрузки. */
export type Links = {
    vk: string;
    google: string;
    telegram: string;
    yandex: string;
};

export const currentLinks = async (userId: string): Promise<Links | null> => {
    try {
        const client = await clientPromise;
        const me = await client.db("typikon-users")
            .collection("users")
            .findOne({ _id: new ObjectId(userId) }, { projection: { auth: 1 } });
        if (!me) return null;
        const auth = me.auth as any;
        return {
            vk: auth?.vk?.userId ?? "",
            google: auth?.google?.userId ?? "",
            telegram: auth?.telegram?.userId ?? "",
            yandex: auth?.yandex?.userId ?? "",
        };
    } catch (e) {
        reportError(e, { where: "lib/authorize/link#currentLinks" });
        return null;
    }
};

/** Входы, которыми СЕЙЧАС можно войти. ВК среди них нет: он закрыт. */
const WORKING: Provider[] = ["Google", "Telegram", "Yandex"];

const field = (provider: Provider) => `auth.${AUTH_KEY[provider]}.userId`;

const workingCount = (auth: any): number =>
    WORKING.filter((provider) => !!auth?.[AUTH_KEY[provider]]?.userId).length;

export const linkProvider = async (
    userId: string,
    provider: Provider,
    providerUserId: string,
): Promise<LinkOutcome> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");
        const users = db.collection("users");
        const path = field(provider);

        const owner = await users.findOne({ [path]: providerUserId });
        if (owner) return owner._id.toString() === userId ? "already-yours" : "taken";

        const me = await users.findOne({ _id: new ObjectId(userId) });
        if (!me) return "no-user";

        const mine = (me.auth as any)?.[AUTH_KEY[provider]]?.userId;
        if (mine && mine !== providerUserId) return "occupied";

        // Условие в фильтре, а не только в проверке выше: между `findOne` и
        // `updateOne` та же запись могла получить привязку из другой вкладки.
        // От гонки ДВУХ РАЗНЫХ записей за один идентификатор это не спасает —
        // для этого нужен уникальный индекс, а ставить его на живую коллекцию
        // вслепую нельзя: он отвергнет уже существующие совпадения, если они есть.
        const res = await users.updateOne(
            {
                _id: new ObjectId(userId),
                $or: [{ [path]: { $exists: false } }, { [path]: providerUserId }],
            },
            { $set: { [path]: providerUserId } },
        );
        return res.matchedCount === 1 ? "ok" : "occupied";
    } catch (e) {
        reportError(e, { where: "lib/authorize/link#linkProvider" });
        return "error";
    }
};

export const unlinkProvider = async (
    userId: string,
    provider: Provider,
): Promise<UnlinkOutcome> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");
        const users = db.collection("users");

        const me = await users.findOne({ _id: new ObjectId(userId) });
        if (!me) return "no-user";

        const auth = me.auth as any;
        if (!auth?.[AUTH_KEY[provider]]?.userId) return "absent";

        // Последний рабочий вход не снимается: сняв его, человек запер бы себя
        // снаружи собственной записи, и вернуть её можно было бы только руками.
        if (workingCount(auth) <= 1) return "last";

        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $unset: { [`auth.${AUTH_KEY[provider]}`]: "" } },
        );
        return "ok";
    } catch (e) {
        reportError(e, { where: "lib/authorize/link#unlinkProvider" });
        return "error";
    }
};

/**
 * Снятие закрытого входа — отдельно: ВК не входит в число рабочих, и обычное
 * правило «последний не снимается» к нему неприменимо. Снять его можно всегда,
 * но только если есть хоть один рабочий, иначе запись осталась бы вовсе без
 * входов.
 */
export const unlinkVk = async (userId: string): Promise<UnlinkOutcome> => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");
        const users = db.collection("users");

        const me = await users.findOne({ _id: new ObjectId(userId) });
        if (!me) return "no-user";

        const auth = me.auth as any;
        if (!auth?.vk?.userId) return "absent";
        if (workingCount(auth) === 0) return "last";

        await users.updateOne({ _id: new ObjectId(userId) }, { $unset: { "auth.vk": "" } });
        return "ok";
    } catch (e) {
        reportError(e, { where: "lib/authorize/link#unlinkVk" });
        return "error";
    }
};
