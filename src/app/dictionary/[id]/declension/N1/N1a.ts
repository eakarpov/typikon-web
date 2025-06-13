import {upperFirst} from "@/app/dictionary/[id]/utils/index";

const N1a = (word: any) => {
    const wordName = word.properties.split(",").includes("persn") ? upperFirst(word.name) : word.name;
    return ({
        normal: wordName,
        base: wordName.replace(/й$/, ""),  // это кастомная - надо удалять последнюю гласную
        endings: [
            // ед. число
            ['й'], // им. п.
            ['ѧ'], // род. п.
            [word.properties.split(",").includes("anim") ? "й" : "ѧ"], // вин. п.
            ['ю'], // дат. п.
            ["емъ"], // тв. п.
            ["и"], // предл. п.
            ["ю"], // зв. п.

            // дв. число
            ['ѧ'], // им. п.
            ["ю"], // род. п.
            ["а"], // вин. п.
            ["ема"], // дат. п.
            ["ема"], // тв. п.
            ['ю'], // предл. п.
            ["ѧ"], // зв. п.

            // мн. число
            ['и'], // им. п.
            ["євъ"], // род. п.
            ["и"], // вин. п.
            ["ємъ"], // дат. п.
            ['и'], // тв. п.
            ["ехъ"], // предл. п.
            ["и"], // зв. п.
        ],
    });
}

export default N1a;
