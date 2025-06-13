import {upperFirst} from "@/app/dictionary/[id]/utils/index";

const N1k_extra = (word: any) => {
    const wordName = word.properties.split(",").includes("persn") ? upperFirst(word.name) : word.name;
    return ({
        normal: wordName,
        base: wordName.replace(/ъ$/, ""),  // это кастомная - надо удалять последнюю гласную
        endings: [
            // ед. число
            ['ъ'], // им. п.
            ['а'], // род. п.
            [word.properties.split(",").includes("anim") ? "а" : ""], // вин. п.
            ['у'], // дат. п.
            ["омъ"], // тв. п.
            ["ѣ"], // предл. п.
            ["е"], // зв. п.

            // дв. число
            ['а'], // им. п.
            ["у"], // род. п.
            ["а"], // вин. п.
            ["ома"], // дат. п.
            ["ома"], // тв. п.
            ['у'], // предл. п.
            [""], // зв. п.

            // мн. число
            ['и'], // им. п.
            ["овъ"], // род. п.
            ["ы"], // вин. п.
            ["омъ"], // дат. п.
            ['ы'], // тв. п.
            ["ѣхъ"], // предл. п.
            ["и"], // зв. п.
        ],
    });
}

export default N1k_extra;
