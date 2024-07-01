import React from "react";
import SettingsPage from "@/app/settings/SettingsPage";

const SettingsContent = async ({ itemsPromise }: {itemsPromise: any}) => {
    const data = await itemsPromise;

    if (!data) {
        return (
            <div>
                <p>
                    Данные не получены. Редактирование недоступно.
                </p>
            </div>
        );
    }

    return (
        <div>
            <SettingsPage data={data} />
        </div>
    )
};

export default SettingsContent;
