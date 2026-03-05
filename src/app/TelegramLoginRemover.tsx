'use client';
import {useEffect} from "react";
import { usePathname } from 'next/navigation'

const TelegramLoginRemover = () => {
    const pathname = usePathname();

    useEffect(()  => {
        if (pathname !== "/login") {
            const el = document.getElementById("telegram-login-typikonBot");
            if (el) {
                el.remove();
            }
        }
    }, [pathname]);

    return null;
};

export default TelegramLoginRemover;