import clientPromise from "@/lib/mongodb";

export const getItems = async () => {
    try {
        const client = await clientPromise;
        const db = client.db("typikon1");

        const weeks = await db
            .collection("weeks")
            .aggregate([
                { $match: { penticostration: true }},
                {
                    $lookup: {
                        from: "days",
                        localField: "days",
                        foreignField: "_id",
                        as: "days"
                    },
                },
                {
                    $addFields: {
                        id: { $toString: "$_id" },
                    }
                },
                {
                    $addFields: {
                        "days": {
                            $map: {
                                input: "$days",
                                as: "i",
                                in: {
                                    $mergeObjects: [
                                      '$$i',
                                      { id: { $toString: "$$i._id" }},
                                    ],
                                },
                            },
                        },
                    },
                },
                {
                    $addFields: {
                        "days": {
                            $sortArray: {
                                input: "$days",
                                sortBy: { weekIndex: 1 }
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        "days.weekId": 0,
                        "days._id": 0,
                    },
                },
            ])
            .toArray();
        console.log(weeks[0]);
        return [weeks, null];
    } catch (e) {
        console.error(e);
        return [null, {error: "Ошибка при загрузке данных"}];
    }
    return Promise.resolve([
        {
            week: 1,
            items: [
                { name: "Пасха", id: Math.random(), dayId: "63c96246e99d9f4d9010c596" },
                { name: "Понедельник светлой седмицы", id: Math.random() },
                { name: "Вторник светлой седмицы", id: Math.random() },
                { name: "Среда светлой седмицы", id: Math.random() },
                { name: "Четверг светлой седмицы", id: Math.random() },
                { name: "Пятница светлой седмицы", id: Math.random() },
                { name: "Суббота светлой седмицы", id: Math.random() },
            ]
        },
        {
            week: 2,
            items: [
                { name: "Фомина неделя", id: Math.random() },
                { name: "Понедельник второй седмицы по Пасхе", id: Math.random() },
                { name: "Вторник второй седмицы по Пасхе", id: Math.random() },
                { name: "Среда второй седмицы по Пасхе", id: Math.random() },
                { name: "Четверг второй седмицы по Пасхе", id: Math.random() },
                { name: "Пятница второй седмицы по Пасхе", id: Math.random() },
                { name: "Суббота второй седмицы по Пасхе", id: Math.random() },
            ]
        },
        {
            week: 3,
            items: [
                { name: "Неделя мироносиц", id: Math.random() },
                { name: "Понедельник третьей седмицы по Пасхе", id: Math.random() },
                { name: "Вторник третьей седмицы по Пасхе", id: Math.random() },
                { name: "Среда третьей седмицы по Пасхе", id: Math.random() },
                { name: "Четверг третьей седмицы по Пасхе", id: Math.random() },
                { name: "Пятница третьей седмицы по Пасхе", id: Math.random() },
                { name: "Суббота третьей седмицы по Пасхе", id: Math.random() },
            ]
        },
        {
            week: 4,
            items: [
                { name: "Неделя о расслабленном", id: Math.random() },
                { name: "Понедельник четвертой седмиц по Пасхеы", id: Math.random() },
                { name: "Вторник четвертой седмицы по Пасхе", id: Math.random() },
                { name: "Преполовение Пятидесятницы", id: Math.random() },
                { name: "Четверг четвертой седмицы по Пасхе", id: Math.random() },
                { name: "Пятница четвертой седмицы по Пасхе", id: Math.random() },
                { name: "Суббота четвертой седмицы по Пасхе", id: Math.random() },
            ]
        },
        {
            week: 5,
            items: [
                { name: "Неделя о самаряныни", id: Math.random() },
                { name: "Понедельник пятой седмицы по Пасхе", id: Math.random() },
                { name: "Вторник пятой седмицы по Пасхе", id: Math.random() },
                { name: "Среда пятой седмицы по Пасхе", id: Math.random() },
                { name: "Четверг пятой седмицы по Пасхе", id: Math.random() },
                { name: "Пятница пятой седмицы по Пасхе", id: Math.random() },
                { name: "Суббота пятой седмицы по Пасхе", id: Math.random() },
            ]
        },
        {
            week: 6,
            items: [
                { name: "Неделя о слепом", id: Math.random() },
                { name: "Понедельник шестой седмицы по Пасхе", id: Math.random() },
                { name: "Вторник шестой седмицы по Пасхе", id: Math.random() },
                { name: "Отдание Пасхи", id: Math.random() },
                { name: "Вознесение", id: Math.random() },
                { name: "Пятница шестой седмицы по Пасхе", id: Math.random() },
                { name: "Суббота шестой седмицы по Пасхе", id: Math.random() },
            ]
        },
        {
            week: 7,
            items: [
                { name: "Неделя святых отец 1 собора", id: Math.random() },
                { name: "Понедельник седьмой седмицы по Пасхе", id: Math.random() },
                { name: "Вторник седьмой седмицы по Пасхе", id: Math.random() },
                { name: "Среда седьмой седмицы по Пасхе", id: Math.random() },
                { name: "Четверг седьмой седмицы по Пасхе", id: Math.random() },
                { name: "Пятница седьмой седмицы по Пасхе", id: Math.random() },
                { name: "Суббота седьмой седмицы по Пасхе", id: Math.random() },
            ]
        },
        {
            week: 8,
            items: [
                { name: "Троица", id: Math.random() },
            ]
        },
        {
            week: 9,
            items: [
                { name: "День Святаго Духа", id: Math.random() },
                { name: "Вторник первой седмицы по Пятидесятнице", id: Math.random() },
                { name: "Среда первой седмицы по Пятидесятнице", id: Math.random() },
                { name: "Четверг первой седмицы по Пятидесятнице", id: Math.random() },
                { name: "Пятница первой седмицы по Пятидесятнице", id: Math.random() },
                { name: "Суббота первой седмицы по Пятидесятнице", id: Math.random() },
                { name: "Неделя всех святых", id: Math.random() },
            ]
        },
    ]);
};
