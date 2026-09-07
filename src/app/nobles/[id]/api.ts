import {init} from "@/lib/sqlite";
import type {CoupleRow, FamilyRow, NobleRow, RuleRow, StateRow} from "@/lib/nobles/types";
import {reportError} from "@/lib/reportError";

export const getItem = async (id: string) => {
    try {
        const db = await init();

        const data = await db.prepare(`select * from nobles where id=?`).get(id) as NobleRow | undefined;

        // Прежде отсутствие персоны выходило наружу исключением при обращении к
        // полю несуществующей строки; страница показывала ту же ошибку, но по
        // пути через catch. Проверка называет случай прямо.
        if (!data) {
            return [null, `Персона ${id} не найдена.`];
        }

        const family = await db.prepare(`select * from families where id=?`).get(data.familyId) as FamilyRow | undefined;

        const isMale = !!data.gender;

        const resultTemp = await db.prepare(`select * from couples where husbandId = ? or wifeId = ?`).all(
            id,
            id
        ) as CoupleRow[];

        const spousesTemp = resultTemp
            .filter((item) => isMale ? item.husbandId === parseInt(id) : item.wifeId === parseInt(id) );

        const selectRequest = await db.prepare(`select * from nobles where id= ?`);

        const spousesData: NobleRow[] = [];
        for (const item of spousesTemp) {
            spousesData.push(...selectRequest.all(
                isMale ? item.wifeId : item.husbandId
            ) as NobleRow[]);
        }

        const spouses = spousesTemp.map((item) => ({
            ...item,
            data: spousesData.find((el) => isMale ? el.id === item.wifeId : el.id === item.husbandId),
        }));

        const children = await db.prepare(`select * from nobles where fatherId=? or motherId=?`).all(id, id) as NobleRow[];

        const rulesTemp = await db.prepare(`select * from rules where personId=?`).all(id) as RuleRow[];

        // const suzerainDataRequest = await db.prepare(`select * from states where id=?`);
        //
        // const suzerainData: any[] = [];
        // for (const item of rulesTemp) {
        //     suzerainData.push(...suzerainDataRequest.all(
        //         item.suzerainId,
        //     ));
        // }

        const predessorDataRequest = await db.prepare(`select * from rules where id= ?`);

        const predessorData: RuleRow[] = [];
        for (const item of rulesTemp) {
            predessorData.push(...predessorDataRequest.all(
                item.predessorId,
            ) as RuleRow[]);
        }

        const successorDataRequest = await db.prepare(`select * from rules where predessorId= ?`);

        const successorData: RuleRow[] = [];
        for (const item of rulesTemp) {
            successorData.push(...successorDataRequest.all(
                item.id,
            ) as RuleRow[]);
        }

        const selectStateDataRequest = await db.prepare(`select * from states where id= ?`);

        // Государства и персоны ниже собираются одиночными get(): ссылка может
        // никуда не вести (правление на несуществующее государство), и тогда
        // строки просто нет. Прежде в массив попадал undefined, и следующий же
        // find() по нему падал — теперь ненайденное не кладётся вовсе.
        const statesData: StateRow[] = [];
        const pushState = (value: unknown) => {
            if (value) statesData.push(value as StateRow);
        };
        for (const item of rulesTemp) {
            pushState(selectStateDataRequest.get(
                item.stateId,
            ));
            statesData.push(...selectStateDataRequest.all(
                item.suzerainId,
            ) as StateRow[]);
        }
        for (const item of predessorData) {
            pushState(selectStateDataRequest.get(
                item.stateId,
            ));
        }
        for (const item of successorData) {
            pushState(selectStateDataRequest.get(
                item.stateId,
            ));
        }

        const selectRuleDataRequest = await db.prepare(`select * from nobles where id= ?`);

        const rulesData: NobleRow[] = [];
        const pushNoble = (value: unknown) => {
            if (value) rulesData.push(value as NobleRow);
        };
        for (const item of rulesTemp) {
            rulesData.push(...selectRuleDataRequest.all(
                item.personId,
            ) as NobleRow[]);
        }
        for (const item of predessorData) {
            pushNoble(selectRuleDataRequest.get(
                item.personId,
            ));
        }
        for (const item of successorData) {
            pushNoble(selectRuleDataRequest.get(
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

        const father = await db.prepare(`select * from nobles where id= ?`).get(data.fatherId) as NobleRow | undefined;

        const mother = await db.prepare(`select * from nobles where id= ?`).get(data.motherId) as NobleRow | undefined;

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
        reportError(e, { where: "app/nobles/[id]/api#getItem" });
        return [null, e];
    }
};
