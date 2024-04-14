import {headers} from "next/headers";

export const setMeta = () => {
    const headersList = headers();
    const domain = headersList.get('host') || "";
    const fullUrl = headersList.get('referer') || "";
    console.log(domain, fullUrl, `${process.env.NODE_ENV === "development" ? `http` : `https`}://${domain}/api/meta/log?source=${fullUrl}`);
    fetch(`${process.env.NODE_ENV === "development" ? `http` : `https`}://${domain}/api/meta/log?source=${fullUrl}`);
};
