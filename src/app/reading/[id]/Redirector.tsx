"use client";

import {redirect} from "next/navigation";

const Redirector = ({ alias }: { alias: string }) => {
    const hash = typeof window !== 'undefined' ? window.location.hash : "";
    if (hash) {
        redirect(`/reading/${alias}${hash}`);
    } else {
        redirect(`/reading/${alias}`);
    }
    return null;
}

export default Redirector;