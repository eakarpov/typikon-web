import React from "react";
import {Metadata} from "next";
import {myFont} from "@/utils/font";
import ReadingSettings from "@/app/settings/ReadingSettings";

export const metadata: Metadata = {
    title: "Настройки чтения",
    description: "Размер текста, междустрочный интервал, ширина колонки и цвета для чтения уставных текстов.",
};

const Settings = () => (
    <div className={`${myFont.variable} pt-2`}>
        <h2 className="font-serif font-bold text-lg">Настройки чтения</h2>
        <ReadingSettings />
    </div>
);

export default Settings;
