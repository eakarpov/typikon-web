import localFont from "next/font/local";

export const myFont = localFont({
    src: [
        {
            path: "../../public/fonts/OldStandard-Regular.otf",
            weight: "normal",
        },
        {
            path: "../../public/fonts/OldStandard-Bold.otf",
            weight: "bold",
        },
    ],
    variable: '--font-old-standard',
    display: "swap",
});

export const csFont = localFont({
    src: [
        {
            path: "../../public/fonts/Monomakh-Regular.ttf",
            weight: "normal",
        },
    ],
    variable: '--font-monomakh',
    display: "swap",
});
