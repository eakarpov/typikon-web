import {init} from "@/lib/sqlite";

export const getItem = async (id: string) => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from states where id=?`).get(id);

        return [data, null];
    } catch (e) {
        console.error(e);
    }
};
