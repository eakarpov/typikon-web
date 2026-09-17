import React, {memo} from "react";
import Login from "@/app/login/Content";

const LoginPage = () => {
    return (
        <Login
            vkApp={parseInt(process.env.VK_APP!)}
            googleApp={process.env.GOOGLE_APP!}
            // ПЕРЕЕЗД, временно. У Google клиент привязан к списку источников, и
            // новый про старый адрес не знает: вход на typikon.su пойдёт только
            // прежним клиентом. Отдаём оба, выбирает браузер по своему адресу —
            // так страница остаётся статической, а не читает заголовки.
            googleAppLegacy={process.env.GOOGLE_APP_OLD ?? process.env.GOOGLE_APP!}
            codeVerifier={process.env.CODE_VERIFIER!}
            hasVkAuth={process.env.HAS_VK_AUTH! === "true"}
        />
    )
};

export default memo(LoginPage);
