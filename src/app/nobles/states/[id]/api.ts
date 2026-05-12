import {init} from "@/lib/sqlite";

export const getItem = async (id: string) => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from states where id=?`).get(id);

        const rulesTemp = await db.prepare(`select * from rules where stateId= ?`).all(data.id)

        const personDataRequest = await db.prepare(`select * from nobles where id= ?`);

        const personData: any[] = [];
        for (const item of rulesTemp) {
            personData.push(personDataRequest.get(
                item.personId,
            ));
            if (item.regentId) {
                personData.push(personDataRequest.get(
                    item.regentId,
                ));
            }
        }

        const predessor = await db.prepare(`select * from states where id= ?`).get(data.predessorId);

        const successor = await db.prepare(`select * from states where predessorId= ?`).get(data.id);

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
        console.error(e);
        return [null, e];
    }
};
