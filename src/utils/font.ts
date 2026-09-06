import localFont from "next/font/local";

// Шрифты сайта — в woff2.
//
// До этого лежали TTF и OTF: 1 971 КБ на весь набор, из них около 450 КБ (Old
// Standard обычный и жирный) едет до первой отрисовки на каждой странице.
// woff2 — то же содержимое, упакованное иначе: все знаки, вся разметка на
// месте, вес вдвое меньше (853 КБ на набор). Сабсеттинг дал бы больше, но для
// церковнославянского он опасен — выносные и уставные начертания легко не
// попасть в набор, а обнаружится это на чужом тексте. Пересборка —
// `npm run fonts:woff2`.

export const myFont = localFont({
    src: [
        { path: "../../public/fonts/OldStandard-Regular.woff2", weight: "normal" },
        { path: "../../public/fonts/OldStandard-Bold.woff2", weight: "bold" },
    ],
    variable: "--font-old-standard",
    display: "swap",
});

// Церковнославянские шрифты. Объявлены все, но браузер скачивает лишь тот,
// которым что-то набрано: незадействованное семейство остаётся объявлением.
// Выбор читателя приезжает переменной --cs-font (см. @/lib/settings/reading).

export const csFont = localFont({
    src: [{ path: "../../public/fonts/Monomakh-Regular.woff2", weight: "normal" }],
    variable: "--font-monomakh",
    display: "swap",
});

export const ponomarFont = localFont({
    src: [{ path: "../../public/fonts/Ponomar-Regular.woff2", weight: "normal" }],
    variable: "--font-ponomar",
    display: "swap",
});

export const triodionFont = localFont({
    src: [{ path: "../../public/fonts/Triodion-Regular.woff2", weight: "normal" }],
    variable: "--font-triodion",
    display: "swap",
});

export const fedorovskFont = localFont({
    src: [{ path: "../../public/fonts/Fedorovsk-Regular.woff2", weight: "normal" }],
    variable: "--font-fedorovsk",
    display: "swap",
});

/**
 * Все церковнославянские семейства разом — для обёртки страницы.
 *
 * Ставится там же, где стоял `csFont.variable`: без объявления переменной
 * выбранное читателем семейство не к чему привязать.
 */
export const csFontVariables = [
    csFont.variable,
    ponomarFont.variable,
    triodionFont.variable,
    fedorovskFont.variable,
].join(" ");
