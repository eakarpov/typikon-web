import {init} from "@/lib/sqlite";
import {reportError} from "@/lib/reportError";

export const getItems = async () => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from states`).all();

        return [data, null];
    } catch (e) {
        reportError(e, { where: "app/admin/nobles/states/api#getItems" });
        return [null, {error: e}];
    }
};
