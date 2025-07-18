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
                                                {textId: {$toString: "$$i.textId"}},
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

export const aggregationTextWithBook = [
    {
        $lookup: {
            from: "texts",
            pipeline: [],
            as: "texts"
        },
    },
    {
        $lookup: {
            from: "books",
            pipeline: [],
            as: "books"
        },
    },
    // Может быть какая оптимизация возможно по ключу сначала смаппить книги и тексты, а потом уже в запрос кидать
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
