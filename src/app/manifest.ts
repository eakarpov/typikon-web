import { MetadataRoute } from "next";

// Манифест приложения: без него браузер не предложит установку на домашний экран.
// Иконки взяты из мобильного приложения (StudioProjects/Typikon), чтобы установленный
// сайт и приложение выглядели на домашнем экране одинаково. Цвета — оттуда же:
// #880015 — фон иконки, #faf6df — круг.
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Уставные чтения",
        short_name: "Чтения",
        description:
            "Последование уставных чтений по Типикону для корпуса церковнославянских текстов.",
        lang: "ru",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#880015",
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            // maskable не заявляем: у иконки кремовый круг доходит до краёв, и маска
            // Android срезала бы красную рамку вместе с краем круга — не тот вид,
            // который задуман. Как обычную иконку лаунчер её и так рисует правильно.
        ],
        // Ярлыки при долгом нажатии на иконку — сразу к тому, ради чего заходят.
        shortcuts: [
            { name: "Чтения на сегодня", url: "/calendar/today" },
            { name: "Поиск", url: "/search" },
        ],
    };
}
