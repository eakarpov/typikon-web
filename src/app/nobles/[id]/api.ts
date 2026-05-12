import {init} from "@/lib/sqlite";

export const getItem = async (id: string) => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from nobles where id=?`).get(id);

        const family = await db.prepare(`select * from families where id=?`).get(data.familyId);

        const isMale = !!data.gender;

        const resultTemp = await db.prepare(`select * from couples where husbandId = ? or wifeId = ?`).all(
            id,
            id
        );

        const spousesTemp = resultTemp
            .filter((item) => isMale ? item.husbandId === parseInt(id) : item.wifeId === parseInt(id) );

        const selectRequest = await db.prepare(`select * from nobles where id= ?`);

        const spousesData: any[] = [];
        for (const item of spousesTemp) {
            spousesData.push(...selectRequest.all(
                isMale ? item.wifeId : item.husbandId
            ));
        }

        const spouses = spousesTemp.map((item) => ({
            ...item,
            data: spousesData.find((el) => isMale ? el.id === item.wifeId : el.id === item.husbandId),
        }));

        const children = await db.prepare(`select * from nobles where fatherId=? or motherId=?`).all(id, id);

        const rulesTemp = await db.prepare(`select * from rules where personId=?`).all(id);

        // const suzerainDataRequest = await db.prepare(`select * from states where id=?`);
        //
        // const suzerainData: any[] = [];
        // for (const item of rulesTemp) {
        //     suzerainData.push(...suzerainDataRequest.all(
        //         item.suzerainId,
        //     ));
        // }

        const predessorDataRequest = await db.prepare(`select * from rules where id= ?`);

        const predessorData: any[] = [];
        for (const item of rulesTemp) {
            predessorData.push(...predessorDataRequest.all(
                item.predessorId,
            ));
        }

        const successorDataRequest = await db.prepare(`select * from rules where predessorId= ?`);

        const successorData: any[] = [];
        for (const item of rulesTemp) {
            successorData.push(...successorDataRequest.all(
                item.id,
            ));
        }

        const selectStateDataRequest = await db.prepare(`select * from states where id= ?`);

        const statesData: any[] = [];
        for (const item of rulesTemp) {
            statesData.push(selectStateDataRequest.get(
                item.stateId,
            ));
            statesData.push(...selectStateDataRequest.all(
                item.suzerainId,
            ));
        }
        for (const item of predessorData) {
            statesData.push(selectStateDataRequest.get(
                item.stateId,
            ));
        }
        for (const item of successorData) {
            statesData.push(selectStateDataRequest.get(
                item.stateId,
            ));
        }

        const selectRuleDataRequest = await db.prepare(`select * from nobles where id= ?`);

        const rulesData: any[] = [];
        for (const item of rulesTemp) {
            rulesData.push(...selectRuleDataRequest.all(
                item.personId,
            ));
        }
        for (const item of predessorData) {
            rulesData.push(selectRuleDataRequest.get(
                item.personId,
            ));
        }
        for (const item of successorData) {
            rulesData.push(selectRuleDataRequest.get(
                item.personId,
            ));
        }

        const rules = rulesTemp.map((item) => {
            const suzerainRule = statesData.find((el) => el.id === item.suzerainId);
            const successorRule = successorData.find((el) => el.predessorId === item.id);
            const predessorRule = predessorData.find((el) => el.id === item.predessorId);
            return ({
                ...item,
                data: rulesData.find((el) => el.id === item.personId),
                predessor: predessorRule ? ({
                    ...predessorRule,
                    state: statesData.find((el) => el.id === predessorRule.stateId),
                    person: rulesData.find((el) => el.id === predessorRule.personId),
                }) : null,
                successor: successorRule ? ({
                    ...successorRule,
                    state: statesData.find((el) => el.id === successorRule.stateId),
                    person: rulesData.find((el) => el.id === successorRule.personId),
                }) : null,
                suzerain: suzerainRule || null,
                state: statesData.find((el) => el.id === item.stateId),
            })
        });

        const father = await db.prepare(`select * from nobles where id= ?`).get(data.fatherId);

        const mother = await db.prepare(`select * from nobles where id= ?`).get(data.motherId);

        // geshwester

        return [{
            data,
            spouses,
            children,
            rules,
            mother,
            father,
            family,
        }, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};
