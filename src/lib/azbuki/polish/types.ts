// Типы польской азбуки. Движок (engine.js) выгружается из проекта azbuki
// дословно, поэтому описание его поверхности живёт здесь, а не в нём.

/** Словник ятя: образцы корней и падежные формы. Забирается из public/. */
export interface YatData {
    /** Образцы, где гласная восходит к *ě: `św@`, `=niech`, `~sieb@`, `-n@j`. */
    yes: string[];
    /** Образцы, где её там нет: `słysz@` (из *-ati), `j@den` (*edinъ). */
    no: string[];
    /** Приставки, которые снимаются перед прикладыванием образца. */
    prefix: string[];
    /** Заимствования, где i перед гласной — глайд: radio, klient. */
    loans: string[];
    /** Местный и дательный: окончание -e из *-ě (niebie, mieście). */
    gram: string[];
}

/** Кусок переведённого текста. */
export interface Piece {
    /** Запись азбукой (у знаков препинания — они сами). */
    text: string;
    /** Правда, если в слове есть гнездо, по которому словник молчит. */
    open: boolean;
    /** Исходное написание латиницей. */
    src: string;
}

export interface Translit {
    translit(text: string): Piece[];
    word(w: string): { text: string; open: boolean };
    yatDecide(w: string): Record<number, boolean>;
    candidates(w: string): [number, number][];
}

/** Что показывается в поле перевода по нажатию на образец. */
export const SAMPLES: { label: string; text: string }[] = [
    {
        label: "Модлитва",
        text: "Ojcze nasz, który jesteś w niebie, niech się święci imię Twoje! " +
            "Niech przyjdzie królestwo Twoje; niech Twoja wola spełnia się na ziemi, " +
            "tak jak i w niebie.",
    },
    {
        label: "Декларация",
        text: "Wszyscy ludzie rodzą się wolni i równi w swojej godności i prawach. " +
            "Są obdarzeni rozumem i sumieniem i powinni postępować wobec siebie " +
            "w duchu braterstwa.",
    },
    {
        label: "Хрущ",
        text: "W Szczebrzeszynie chrząszcz brzmi w trzcinie i Szczebrzeszyn z tego słynie. " +
            "Wół go pyta: Panie chrząszczu, po cóż pan tak brzęczy w gąszczu?",
    },
    {
        label: "Буквы",
        text: "miód, lód, niósł, siódmy, pióro, siostra, wiosna, ciotka, ludziom, świat, " +
            "wiara, miasto, lato, chleb, człowiek, mleko, śnieg, radio, klient, znajomy, " +
            "herbata, dżem, jeden, kiedy, pies, kobieta, świetny, powietrze",
    },
];
