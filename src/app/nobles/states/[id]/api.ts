import {init} from "@/lib/sqlite";
import type {NobleRow, RuleRow, StateRow} from "@/lib/nobles/types";
import {reportError} from "@/lib/reportError";

export const getItem = async (id: string) => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from states where id=?`).get(id) as StateRow | undefined;

        if (!data) {
            return [null, `Государство ${id} не найдено.`];
        }

        const rulesTemp = await db.prepare(`select * from rules where stateId= ?`).all(data.id) as RuleRow[];

        const personDataRequest = await db.prepare(`select * from nobles where id= ?`);

        // Ненайденное не кладётся: ссылка правления может никуда не вести,
        // и прежде undefined в массиве ронял find() ниже.
        const personData: NobleRow[] = [];
        const pushPerson = (value: unknown) => {
            if (value) personData.push(value as NobleRow);
        };
        for (const item of rulesTemp) {
            pushPerson(personDataRequest.get(
                item.personId,
            ));
            if (item.regentId) {
                pushPerson(personDataRequest.get(
                    item.regentId,
                ));
            }
        }

        const predessor = await db.prepare(`select * from states where id= ?`).get(data.predessorId) as StateRow | undefined;

        const successor = await db.prepare(`select * from states where predessorId= ?`).get(data.id) as StateRow | undefined;

        return [{
            data,
            rules: rulesTemp.map((item) => {
                return ({
                    ...item,
                    person: personData.find((person) => person.id === item.personId),
                    regent: item.regentId
                        ? personData.find((person) => person.id === item.regentId)
                        : undefined,
                })
            }),
            predessor,
            successor,
        }, null];
    } catch (e) {
        reportError(e, { where: "app/nobles/states/[id]/api#getItem" });
        return [null, e];
    }
};
