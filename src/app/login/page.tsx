import React, {memo} from "react";
import Login from "@/app/login/Content";

const LoginPage = () => {
    return (
        <Login
            vkApp={parseInt(process.env.VK_APP!)}
            googleApp={process.env.GOOGLE_APP!}
            codeVerifier={process.env.CODE_VERIFIER!}
            hasVkAuth={process.env.HAS_VK_AUTH! === "true"}
        />
    )
};

export default memo(LoginPage);
