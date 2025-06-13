import {upperFirst} from "@/app/dictionary/[id]/utils/index";

// todo перенос ударений на окончание как?

const N1j = (word: any) => {
    const wordName = word.properties.split(",").includes("persn") ? upperFirst(word.name) : word.name;
    return ({
        normal: wordName,
        base: wordName.replace(/ь$/, ""),  // это кастомная - надо удалять последнюю гласную
        endings: [
            // ед. число
            ['ь'], // им. п.
            ['ѧ'], // род. п.
            [word.properties.split(",").includes("anim") ? "ѧ" : ""], // вин. п.
            ['ю'], // дат. п.
            ["и"], // тв. п.
            ["емъ"], // предл. п.
            ["ю"], // зв. п.

            // дв. число
            ['ѧ'], // им. п.
            ["ю"], // род. п.
            ["ѧ"], // вин. п.
            ["ема"], // дат. п.
            ["ема"], // тв. п.
            ['ю'], // предл. п.
            ["їѧ"], // зв. п.

            // мн. число
            ['и'], // им. п.
            ["єй"], // род. п.
            ["и", "єй"], // вин. п.
            ["ємъ"], // дат. п.
            ['и', 'ьми'], // тв. п.
            ["ехъ"], // предл. п.
            ["їе"], // зв. п.
        ],
    });
}

export default N1j;
