import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {reportError} from "@/lib/reportError";

export const getUserInfo = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const users = await db
            .collection("users")
            .find({
                _id: new ObjectId(id),
            })
            .toArray();
        return users[0];
    } catch (e) {
        reportError(e, { where: "lib/authorize/users#getUserInfo" });
    }
};

export const registerNewUserWithGoogle = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const users = await db
            .collection("users")
            .insertOne({
                name: "",
                surname: "",
                email: "",
                phone: "",
                auth: {
                    google: {
                        userId: id.toString(),
                    },
                },
                roles: [],
            });
        return users.insertedId.toString();
    } catch (e) {
        reportError(e, { where: "lib/authorize/users#registerNewUserWithGoogle" });
    }
};

export const registerNewUserWithTelegram = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const users = await db
            .collection("users")
            .insertOne({
                name: "",
                surname: "",
                email: "",
                phone: "",
                auth: {
                    telegram: {
                        userId: id.toString(),
                    },
                },
                roles: [],
            });
        return users.insertedId.toString();
    } catch (e) {
        reportError(e, { where: "lib/authorize/users#registerNewUserWithTelegram" });
    }
};

export const registerNewUserWithYandex = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const users = await db
            .collection("users")
            .insertOne({
                name: "",
                surname: "",
                email: "",
                phone: "",
                auth: {
                    yandex: {
                        userId: id.toString(),
                    },
                },
                roles: [],
            });
        return users.insertedId.toString();
    } catch (e) {
        reportError(e, { where: "lib/authorize/users#registerNewUserWithYandex" });
    }
};

export const getUserByGoogleId = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const user = await db
            .collection("users")
            .findOne({
                "auth.google.userId": id.toString(),
            });
        return user;
    } catch (e) {
        reportError(e, { where: "lib/authorize/users#getUserByGoogleId" });
    }
}

export const getUserByTelegramId = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const user = await db
            .collection("users")
            .findOne({
                "auth.telegram.userId": id.toString(),
            });
        return user;
    } catch (e) {
        reportError(e, { where: "lib/authorize/users#getUserByTelegramId" });
    }
}

export const getUserByYandexId = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const user = await db
            .collection("users")
            .findOne({
                "auth.yandex.userId": id.toString(),
            });
        return user;
    } catch (e) {
        reportError(e, { where: "lib/authorize/users#getUserByYandexId" });
    }
}
