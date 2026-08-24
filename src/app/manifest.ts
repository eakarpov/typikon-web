import { MetadataRoute } from "next";

// Манифест приложения: без него браузер не предложит установку на домашний экран.
// Иконки в public/icons — временная заглушка (сплошной прямоугольник, намеренно
// без символа); подставьте настоящий логотип теми же именами и размерами.
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
        theme_color: "#7c2d12",
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // Ярлыки при долгом нажатии на иконку — сразу к тому, ради чего заходят.
        shortcuts: [
            { name: "Чтения на сегодня", url: "/calendar/today" },
            { name: "Поиск", url: "/search" },
        ],
    };
}
