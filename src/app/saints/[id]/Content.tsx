import React from "react";
import SaintPage from "@/app/saints/[id]/SaintPage";

const Content = async ({ itemPromise }: { itemPromise: Promise<any> }) => {

    const [first, second, third] = await itemPromise;
    const [items] = first.value;
    const [mentions] = third.value;

    if (!second.value) {
        return (
            <div>
                Ничего не нашлось
            </div>
        );
    }

    return (
        <SaintPage item={second.value} items={items} mentions={mentions} />
    )
};

export default Content;