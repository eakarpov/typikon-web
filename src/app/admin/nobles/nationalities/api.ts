import {init} from "@/lib/sqlite";

export const getItems = async () => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from nationalities`).all();

        return [data, null];
    } catch (e) {
        console.error(e);
        return [null, {error: e}];
    }
};
