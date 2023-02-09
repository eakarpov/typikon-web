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
                                            triodic: "$$i.triodic",
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
