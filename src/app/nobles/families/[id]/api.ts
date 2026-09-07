import {init} from "@/lib/sqlite";
import type {FamilyRow, NobleRow} from "@/lib/nobles/types";
import {reportError} from "@/lib/reportError";

export const getItem = async (id: string) => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from families where id=?`).get(id) as FamilyRow | undefined;

        if (!data) {
            return [null, `Род ${id} не найден.`];
        }

        const nobles = await db.prepare(`select * from nobles where familyId= ?`).all(data.id) as NobleRow[];

        return [{
            data,
            persons: nobles,
        }, null];
    } catch (e) {
        reportError(e, { where: "app/nobles/families/[id]/api#getItem" });
        return [null, e];
    }
};
