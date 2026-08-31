import React from "react";
import SaintPage from "@/app/saints/[id]/SaintPage";
import { akathistsOfSaint } from "@/lib/akathists";

// Значение из Promise.allSettled: отклонённое обещание — это "не смогли получить",
// а не повод уронить всю страницу.
const settled = <T,>(result: PromiseSettledResult<T> | undefined, fallback: T): T =>
    result?.status === "fulfilled" ? result.value : fallback;

export interface SaintNaming {
    /** Наше основное именование. Оно главнее того, как памятью подписаны святцы. */
    name: string | null;
    altNames: string[];
}

const Content = async ({ id, itemPromise, naming }: {
    id: string,
    itemPromise: Promise<any>,
    naming?: SaintNaming,
}) => {

    const [textsResult, memoryResult, mentionsResult, nobleResult] = await itemPromise;

    const [items] = settled<[any[], any]>(textsResult, [[], null]);
    const [mentions] = settled<[any[], any]>(mentionsResult, [[], null]);
    const [linkedNoble] = settled<[any, any]>(nobleResult, [null, null]);
    const memory = settled<any>(memoryResult, null);

    // Акафисты этому святому — из корпуса песнопений, синхронно: он лежит в
    // файле SQLite рядом с приложением, и ждать его нечего.
    const akathists = akathistsOfSaint(id);

    // Страница держится на наших текстах, а не на святцах: если dneslov.org молчит,
    // показываем то, что есть у нас. Пусто — только когда пусто с обеих сторон.
    if (!memory && !items?.length && !mentions?.length && !akathists.length) {
        return (
            <div>
                Ничего не нашлось
            </div>
        );
    }

    return (
        <SaintPage
            id={id}
            naming={naming}
            item={memory}
            items={items || []}
            mentions={mentions || []}
            linkedNoble={linkedNoble}
            akathists={akathists}
        />
    )
};

export default Content;
