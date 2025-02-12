import React, {memo} from "react";
import Login from "@/app/login/Content";

const LoginPage = () => {
    return (
        <Login vkApp={parseInt(process.env.VK_APP!)} />
    )
};

export default memo(LoginPage);
