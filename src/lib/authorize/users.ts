import clientPromise from "@/lib/mongodb";

export const getUserInfo = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon-users");

        const users = await db
            .collection("users")
            .find({
                id,
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

        const users = await db
            .collection("users")
            .find({
                auth: {
                    vk: {
                        userId: id,
                    },
                },
            })
            .toArray();
        return users[0];
    } catch (e) {
        console.error(e);
    }
}
