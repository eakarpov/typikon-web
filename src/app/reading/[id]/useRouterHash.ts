'use client';
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export const useRouterHash = () => {
    const searchParams = useSearchParams();
    const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash : null)

    useEffect(() => {
        setHash(typeof window !== 'undefined' ? window.location.hash : null);
    }, [searchParams])

    return hash
}