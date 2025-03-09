import React from "react";
import ChoosePicker from "@/app/settings/ChoosePicker";
import ChooseFontPicker from "@/app/settings/ChooseFontPicker";

const SettingsContent = () => {
    return (
        <div className="flex flex-col">
            <ChoosePicker />
            <ChooseFontPicker />
        </div>
    );
};

export default SettingsContent;
