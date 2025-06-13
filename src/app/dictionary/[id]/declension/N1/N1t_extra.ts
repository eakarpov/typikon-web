import {upperFirst} from "@/app/dictionary/[id]/utils/index";

const N1t_extra = (word: any) => {
    const wordName = word.properties.split(",").includes("persn") ? upperFirst(word.name) : word.name;
    return ({
        normal: wordName,
        base: wordName.replace(/ъ$/, "")
            .replace("е", ""),  // это кастомная - надо удалять последнюю гласную
        endings: [
            // ед. число
            ['ъ'], // им. п.
            ['а'], // род. п.
            [word.properties.split(",").includes("anim") ? "а" : ""], // вин. п.
            ['ꙋ'], // дат. п.
            ["омъ"], // тв. п.
            ["ѣ"], // предл. п.
            ["е"], // зв. п.

            // дв. число
            ['а'], // им. п.
            ["ꙋ"], // род. п.
            ["а"], // вин. п.
            ["ома"], // дат. п.
            ["ома"], // тв. п.
            ['ꙋ'], // предл. п.
            ["а"], // зв. п.

            // мн. число
            ['и'], // им. п.
            ["ѡвъ"], // род. п.
            ["ы", "ѡвъ"], // вин. п.
            ["ѡмъ"], // дат. п.
            ['ы'], // тв. п.
            ["ѣхъ"], // предл. п.
            ["и", "їе"], // зв. п.
        ],
    });
}

export default N1t_extra;
