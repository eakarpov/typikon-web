import React from "react";
import PlacesPage from "@/app/places/[id]/PlacesPage";

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
        <PlacesPage item={item} />
    )
};

export default Content;