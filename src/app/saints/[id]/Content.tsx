import React from "react";
import SaintPage from "@/app/saints/[id]/SaintPage";

// Значение из Promise.allSettled: отклонённое обещание — это "не смогли получить",
// а не повод уронить всю страницу.
const settled = <T,>(result: PromiseSettledResult<T> | undefined, fallback: T): T =>
    result?.status === "fulfilled" ? result.value : fallback;

const Content = async ({ id, itemPromise }: { id: string, itemPromise: Promise<any> }) => {

    const [textsResult, memoryResult, mentionsResult, nobleResult] = await itemPromise;

    const [items] = settled<[any[], any]>(textsResult, [[], null]);
    const [mentions] = settled<[any[], any]>(mentionsResult, [[], null]);
    const [linkedNoble] = settled<[any, any]>(nobleResult, [null, null]);
    const memory = settled<any>(memoryResult, null);

    // Страница держится на наших текстах, а не на святцах: если dneslov.org молчит,
    // показываем то, что есть у нас. Пусто — только когда пусто с обеих сторон.
    if (!memory && !items?.length && !mentions?.length) {
        return (
            <div>
                Ничего не нашлось
            </div>
        );
    }

    return (
        <SaintPage
            id={id}
            item={memory}
            items={items || []}
            mentions={mentions || []}
            linkedNoble={linkedNoble}
        />
    )
};

export default Content;
