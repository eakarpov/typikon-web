import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {TextType} from "@/utils/texts";

const getAggregationAddField = (name: TextType) => {
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

export const getItem = async (id: string) => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const matcher = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { alias: id };

        const days = await db
            .collection("days")
            .aggregate([
                { $match: matcher },
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
                // Для каждого типа поля нужна такая структура
                getAggregationAddField(TextType.VESPERS_PROKIMENON),
                getAggregationAddField(TextType.VIGIL),
                getAggregationAddField(TextType.KATHISMA_1),
                getAggregationAddField(TextType.KATHISMA_2),
                getAggregationAddField(TextType.KATHISMA_3),
                getAggregationAddField(TextType.IPAKOI),
                getAggregationAddField(TextType.POLYELEOS),
                getAggregationAddField(TextType.SONG_3),
                getAggregationAddField(TextType.SONG_6),
                getAggregationAddField(TextType.APOLUTIKA_TROPARIA),
                getAggregationAddField(TextType.BEFORE_1h),
                getAggregationAddField(TextType.PANAGIA),
                getAggregationAddField(TextType.H1),
                getAggregationAddField(TextType.H3),
                getAggregationAddField(TextType.H6),
                getAggregationAddField(TextType.H9),
                {
                  $addFields: {
                      id: { $toString: "$_id" },
                  },
                },
                { $project: { texts: 0, books: 0, weekId: 0, _id: 0 }}
            ])
            .toArray();
        return days[0];
    } catch (e) {
        console.error(e);
        return {};
    }
};
