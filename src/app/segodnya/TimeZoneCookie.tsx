'use client';
import {useEffect} from "react";
import {useRouter} from "next/navigation";

// Пояс читателя — серверу. «Сегодня» у страницы должно быть сегодняшним днём
// читателя, а не сервера: во Владивостоке уже завтра, когда в Москве ещё вечер.
// Сервер пояса не знает, поэтому браузер кладёт его в cookie, и страница
// перечитывается один раз — только если пояс оказался не тем, с каким её собрали.

const TimeZoneCookie = ({assumed}: { assumed: string }) => {
    const router = useRouter();

    useEffect(() => {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!zone || zone === assumed) return;
        document.cookie = `tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
    }, [assumed, router]);

    return null;
};

export default TimeZoneCookie;
