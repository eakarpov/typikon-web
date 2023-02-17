import {TextType} from "@/utils/texts";

export const getAggregationAddField = (name: TextType) => {
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
                                        in: {
                                            cite: "$$i.cite",
                                            paschal: "$$i.paschal",
                                            text: {
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
