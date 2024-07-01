// import SettingsContent from "@/app/settings/Content";
import React, {Suspense} from "react";
import {getMeta} from "@/app/meta/api";

const Settings = () => {
    const metaData = getMeta();

    return (
        <Suspense fallback={<div>Loading...</div>}>
            {/* @ts-expect-error Async Server Component */}
            {/*<SettingsContent itemsPromise={metaData} />*/}
        </Suspense>

    );
};

export default Settings;
