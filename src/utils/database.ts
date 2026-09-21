import {TextType} from "@/utils/texts";
import {ObjectId} from "mongodb";

export const getAggregationAddField = (name: TextType, withText: boolean = true) => {
    const varName = `$${name}`;
    return {
        $addFields: {
            [name]: {
                $cond: {
                    if: { $ne: [varName, null]},
                    else: null,
                    then: {
                        $mergeObjects: [
                            varName,
                            {
                                items: {
                                    $map: {
                                        input: `${varName}.items`,
                                        as: "i",
                                        in: withText ? {
                                            cite: "$$i.cite",
                                            paschal: "$$i.paschal",
                                            description: "$$i.description",
                                            statia: "$$i.statia",
                                            pericopeId: { $toString: "$$i.pericopeId" },
                                            text: {
                                                $mergeObjects: [
                                                    {
                                                        $first: {
                                                            $filter: {
                                                                input: "$texts",
                                                                cond: {
                                                                    $eq: ["$$t._id", "$$i.textId"],
                                                                },
                                                                as: "t",
                                                                limit: 1,
                                                            }
                                                        },
                                                    },
                                                    {
                                                        _id: { $toString: '$$i.textId' }
                                                    }
                                                ]
                                            },
                                        } : {
                                            $mergeObjects: [
                                                '$$i',
                                                {
                                                    textId: { $toString: "$$i.textId" },
                                                    pericopeId: { $toString: "$$i.pericopeId" },
                                                },
                                            ],
                                        },
                                    },
                                }
                            },
                        ],
                    }
                },
            }
        },
    };
};

/**
 * Тексты дня и книги, из которых они взяты.
 *
 * ЗАБИРАЮТСЯ ТОЛЬКО ТЕКСТЫ ЭТОГО ДНЯ, а не вся коллекция, и это не ускорение,
 * а условие работоспособности. Прежде здесь стоял `$lookup` с пустым конвейером:
 * он втягивал в документ дня ВСЕ тексты собрания — без малого восемь тысяч
 * записей с полными телами, десятки мегабайт, — и следующий `$map` проходил по
 * ним по всем, на каждый запрос дня.
 *
 * MongoDB 7.0 это терпела. 8.0 — нет: у неё на выражения вроде `$map` есть
 * предел памяти, и, в отличие от `$group` или `$sort`, на диск он не
 * выплёскивается. Ответ был бы понятнее, если бы речь шла о медленном запросе,
 * но приходит отказ:
 *
 *     PlanExecutor error during aggregation :: caused by ::
 *     $map would use too much memory and cannot spill
 *
 * Наружу это выглядело как 400 от ручки дня и пустые страницы календаря — при
 * живой базе и целых данных. Поэтому идентификаторы текстов собираются из самого
 * документа (по всем полям TextType сразу, чтобы список не разошёлся с ними при
 * добавлении нового), и `$lookup` идёт по `_id`, то есть по индексу.
 */
const TEXT_ID_PATHS = Object.values(TextType).map(
    (field) => ({ $ifNull: [`$${field}.items.textId`, []] }),
);

export const aggregationTextWithBook = [
    {
        $addFields: {
            // $setUnion заодно снимает повторы: один текст может стоять в двух
            // частях службы, и тянуть его дважды незачем.
            _textIds: { $setUnion: TEXT_ID_PATHS },
        },
    },
    {
        // localField массивом — законная форма: совпадением считается любой его
        // элемент, и поиск идёт по индексу _id, а не перебором коллекции.
        $lookup: {
            from: "texts",
            localField: "_textIds",
            foreignField: "_id",
            as: "texts",
        },
    },
    {
        // Книги остаются целиком: их полсотни, и по какой из них искать, видно
        // только после того, как тексты уже найдены.
        $lookup: {
            from: "books",
            pipeline: [],
            as: "books"
        },
    },
    { $unset: "_textIds" },
    {
        $addFields: {
            "texts": {
                $map: {
                    input: "$texts",
                    as: "t",
                    in: {
                        $mergeObjects: [
                            "$$t",
                            {
                                book: {
                                    $first: {
                                        $filter: {
                                            input: "$books",
                                            cond: {
                                                $eq: ["$$b._id", "$$t.bookId"],
                                            },
                                            as: "b",
                                            limit: 1,
                                        }
                                    },
                                },
                            }
                        ],
                    },
                },
            },
        },
    },
];

export const aggregationDayWithMonth = [
    {
        $lookup: {
            from: "months",
            pipeline: [],
            as: "months"
        },
    },
    // Может быть какая оптимизация возможно по ключу сначала смаппить книги и тексты, а потом уже в запрос кидать
    {
        $addFields: {
            month: {
                $first: {
                    $filter: {
                        input: "$months",
                        cond: {
                            $eq: ["$$b._id", "$monthId"],
                        },
                        as: "b",
                        limit: 1,
                    }
                },
            },
        },
    },
];

export const getAggregationFindIdInField = (id: string, field: string) => ({
    $in: [new ObjectId(id), {
        $map: {
            input: {
                $getField: {
                    field: "items",
                    input: {$ifNull: [field, {items: []}]}
                }
            },
            as: "item",
            in: "$$item.textId"
        }
    }]
});
