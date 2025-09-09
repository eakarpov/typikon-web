"use client";

import {redirect} from "next/navigation";

const Redirector = ({ alias }: { alias: string }) => {
    if (window.location.hash) {
        redirect(`/reading/${alias}${window.location.hash}`);
    } else {
        redirect(`/reading/${alias}`);
    }
    return null;
}

export default Redirector;