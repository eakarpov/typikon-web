'use client';
import {useEffect} from "react";

const InitiateUserSettings = () => {

    useEffect(() => {
        const bgColor = localStorage.getItem("typikon-background-color");
        if (bgColor) {
            document.body.style.background = bgColor;
        }
    }, []);

    return null;
};

export default InitiateUserSettings;
