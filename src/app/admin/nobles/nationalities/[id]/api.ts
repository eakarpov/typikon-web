import {init} from "@/lib/sqlite";
import {reportError} from "@/lib/reportError";

export const getItem = async (id: string) => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from nationalities where id=?`).get(id);

        return [data, null];
    } catch (e) {
        reportError(e, { where: "app/admin/nobles/nationalities/[id]/api#getItem" });
    }
};
