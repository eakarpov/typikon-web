import React, {memo} from "react";
import type {Metadata} from "next";
import Login from "@/app/login/Content";
import {isYandexConfigured} from "@/lib/authorize/yandex";

export const metadata: Metadata = {
    title: "Вход — Уставные чтения",
    description: "Вход через Telegram, Google или Яндекс: помянник, записки, заметки и избранное.",
};

const LoginPage = () => {
    return (
        <Login
            googleApp={process.env.GOOGLE_APP!}
            // ПЕРЕЕЗД, временно. У Google клиент привязан к списку источников, и
            // новый про старый адрес не знает: вход на typikon.su пойдёт только
            // прежним клиентом. Отдаём оба, выбирает браузер по своему адресу —
            // так страница остаётся статической, а не читает заголовки.
            googleAppLegacy={process.env.GOOGLE_APP_OLD ?? process.env.GOOGLE_APP!}
            // Имя бота больше не вписано в разметку: виджет привязан к домену,
            // заданному боту в BotFather, и на испытательной машине бот другой.
            telegramBot={process.env.TELEGRAM_BOT_NAME || "typikonBot"}
            // Кнопка Яндекса показывается только если вход настроен: кнопка,
            // ведущая к «выключено», хуже отсутствующей.
            hasYandex={isYandexConfigured()}
        />
    )
};

export default memo(LoginPage);
