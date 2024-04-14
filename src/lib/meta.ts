import {headers} from "next/headers";

export const setMeta = () => {
    const headersList = headers();
    const fullUrl = headersList.get('referer') || "";
    console.log(fullUrl);
    // fetch(`/api/meta/log?source=${fullUrl}`);
};
