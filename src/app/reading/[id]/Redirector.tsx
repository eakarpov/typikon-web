"use client";

import {redirect} from "next/navigation";

const Redirector = ({ alias }: { alias: string }) => {
    const suffix = typeof window !== "undefined" ? window.location.search + window.location.hash : "";
    redirect(`/reading/${alias}${suffix}`);
    return null;
}

export default Redirector;