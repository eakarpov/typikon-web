'use client';
import {useEffect} from "react";

const InitiateUserSettings = () => {

    useEffect(() => {
        const bgColor = localStorage.getItem("typikon-background-color");
        const fontColor = localStorage.getItem("typikon-font-color");
        if (bgColor) {
            document.body.style.background = bgColor;
        }
        if (fontColor) {
            document.body.style.color = fontColor;
        }
    }, []);

    return null;
};

export default InitiateUserSettings;
