'use client';
import React, {memo, useEffect, useRef} from "react";
import * as VKID from '@vkid/sdk';
import {TokenResult} from "@vkid/sdk/dist-sdk/types/auth/types";
import {useAppDispatch, useAppSelector} from "@/lib/hooks";
import {useRouter} from "next/navigation";
import {AuthSlice} from "@/lib/store/auth";

const Login = () => {
    useEffect(() => {
        window.YaSendSuggestToken(
            'https://typikon.su/login',
            {
                flag: true
            }
        )
    }, []);

    return (
        <div>
        </div>
    )
};

export default memo(Login);
