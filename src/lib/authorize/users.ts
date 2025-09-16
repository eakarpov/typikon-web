import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

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
        console.error(e);
    }
};

export const registerNewUserWithVK = async (id: string) => {
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
                    vk: {
                        userId: id,
                    },
                },
                roles: [],
            });
        return users.insertedId.toString();
    } catch (e) {
        console.error(e);
    }
};

export const getUserByVKId = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const user = await db
            .collection("users")
            .findOne({
                auth: {
                    vk: {
                        userId: id,
                    },
                },
            });
        return user;
    } catch (e) {
        console.error(e);
    }
}
