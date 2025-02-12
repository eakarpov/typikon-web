import React, {memo} from "react";
import Login from "@/app/login/Content";
import {redirect} from "next/navigation";
import {useAppSelector} from "@/lib/hooks";

const LoginPage = () => {
    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);

    if (isAuthorized) {
        redirect("/");
    }

    return (
        <Login
            vkApp={parseInt(process.env.VK_APP!)}
            codeVerifier={process.env.CODE_VERIFIER!}
        />
    )
};

export default memo(LoginPage);
