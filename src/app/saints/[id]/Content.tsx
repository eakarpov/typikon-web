import React from "react";
import SaintPage from "@/app/saints/[id]/SaintPage";
import { akathistsOfSaint } from "@/lib/akathists";
import { baseYearLabel, kindLabel, memoryDaysOf, orderLabel } from "@/lib/saintFacts";
import type { SaintMemoryRow } from "@/lib/memories";
import type { SaintDedication } from "@/lib/temples";

// Значение из Promise.allSettled: отклонённое обещание — это "не смогли получить",
// а не повод уронить всю страницу.
const settled = <T,>(result: PromiseSettledResult<T> | undefined, fallback: T): T =>
    result?.status === "fulfilled" ? result.value : fallback;

/** Поля собственной записи каталога — всё, что карточка знает о лице без чужой сети. */
export interface SaintFacts {
    /** Наше основное именование. Оно главнее того, как памятью подписаны святцы. */
    name: string | null;
    altNames: string[];
    type: string | null;
    orders: string[];
    baseYear: number | null;
    memoryDates: string[];
    roundelUrl: string | null;
    images: { url: string; thumbUrl: string | null; title: string | null }[];
}

const Content = async ({ id, itemPromise, facts }: {
    id: string,
    itemPromise: Promise<any>,
    facts?: SaintFacts,
}) => {

    const [textsResult, memoryResult, mentionsResult, nobleResult, saintMemoriesResult, dedicationsResult] =
        await itemPromise;

    const [items] = settled<[any[], any]>(textsResult, [[], null]);
    const [mentions] = settled<[any[], any]>(mentionsResult, [[], null]);
    const [linkedNoble] = settled<[any, any]>(nobleResult, [null, null]);
    const memory = settled<any>(memoryResult, null);
    const saintMemories = settled<SaintMemoryRow[]>(saintMemoriesResult, []);
    const dedications = settled<SaintDedication[]>(dedicationsResult, []);

    // Акафисты этому святому — из корпуса песнопений, синхронно: он лежит в
    // файле SQLite рядом с приложением, и ждать его нечего.
    const akathists = akathistsOfSaint(id);

    // Подписи и даты считаются здесь, на сервере: ниже клиентский компонент, и
    // тащить в браузер словарь чинов с пасхалией ради полутора строк незачем.
    // Дни памяти — от СЕГОДНЯШНЕГО дня: карточку читают, чтобы узнать когда.
    const card = facts && {
        name: facts.name,
        altNames: facts.altNames,
        kind: kindLabel(facts.type),
        orders: facts.orders.map(orderLabel),
        baseYear: baseYearLabel(facts.baseYear),
        days: memoryDaysOf(facts.memoryDates, new Date()),
        roundelUrl: facts.roundelUrl,
        // Иконы с чужого CDN: показываем горсть, а не всё собрание. Каждая
        // миниатюра — запрос к dneslov.org из браузера читателя.
        images: facts.images.filter((img) => img.thumbUrl).slice(0, 4),
    };

    // Страница держится на наших текстах, а не на святцах: если dneslov.org молчит,
    // показываем то, что есть у нас. Пусто — только когда пусто со всех сторон.
    if (!memory && !items?.length && !mentions?.length && !akathists.length
        && !saintMemories.length && !dedications.length && !card?.name) {
        return (
            <div>
                Ничего не нашлось
            </div>
        );
    }

    return (
        <SaintPage
            id={id}
            card={card}
            item={memory}
            items={items || []}
            mentions={mentions || []}
            linkedNoble={linkedNoble}
            akathists={akathists}
            memories={saintMemories}
            dedications={dedications}
        />
    )
};

export default Content;
