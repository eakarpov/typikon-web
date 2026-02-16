import React from "react";
import SignsPage from "@/app/signs/[id]/SignsPage";

const Content = async ({ itemPromise }: { itemPromise: Promise<any> }) => {

    const [item] = await itemPromise;

    if (!item) {
        return (
            <div>
                Ничего не нашлось
            </div>
        );
    }

    return (
        <SignsPage item={item} />
    )
};

export default Content;