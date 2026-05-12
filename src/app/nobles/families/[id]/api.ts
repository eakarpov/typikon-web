import {init} from "@/lib/sqlite";

export const getItem = async (id: string) => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from families where id=?`).get(id);

        const nobles = await db.prepare(`select * from nobles where familyId= ?`).all(data.id)

        return [{
            data,
            persons: nobles,
        }, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
