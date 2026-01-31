import React, {memo} from "react";
import Login from "@/app/login/Content";

const LoginPage = () => {
    return (
        <Login
            vkApp={parseInt(process.env.VK_APP!)}
            yandexApp={process.env.YANDEX_APP!}
            codeVerifier={process.env.CODE_VERIFIER!}
        />
    )
};

export default memo(LoginPage);
