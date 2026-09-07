import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {init} from "@/lib/sqlite";
import {reportError} from "@/lib/reportError";

export const getItem = async (id: string) => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from nobles where id=?`).get(id);

        return [data, null];
    } catch (e) {
        reportError(e, { where: "app/admin/nobles/[id]/api#getItem" });
    }
};
