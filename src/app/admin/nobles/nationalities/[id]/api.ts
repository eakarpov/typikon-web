import {init} from "@/lib/sqlite";

export const getItem = async (id: string) => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from nationalities where id=?`).get(id);

        return [data, null];
    } catch (e) {
        console.error(e);
    }
};
